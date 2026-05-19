#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# publish-desktop.sh
# Uploads Tauri updater + installer artifacts to Cloudflare R2 using
# `wrangler` (the native Cloudflare CLI), and publishes latest.json for
# the Tauri updater endpoint.
#
# Why wrangler over `aws s3`: wrangler is a single npm binary, has no
# Python dependency (awscli's pyexpat crashes on macOS Python 3.14 mismatch),
# and is the official tool for R2 — no need to configure S3-compat endpoint
# URLs or fake region names.
#
# Usage:
#   publish-desktop.sh <VERSION> [NOTES]
#
# Required env vars:
#   CLOUDFLARE_API_TOKEN     Token with R2:Edit permission on the bucket.
#                            Cloudflare dashboard → My Profile → API Tokens.
#   CLOUDFLARE_ACCOUNT_ID    Cloudflare account ID (dashboard right sidebar).
#   R2_BUCKET                Bucket name (e.g. meridian-releases).
#   R2_PUBLIC_URL            Custom domain for the bucket
#                            (e.g. https://releases.meridian.stageholder.com).
#                            Must match the `endpoints` URL in tauri.conf.json.
#
# Optional env vars:
#   UPDATER_DIR              Directory containing updater artifacts.
#   INSTALLER_DIR            Directory containing installer artifacts.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <VERSION> [NOTES]" >&2
  exit 1
fi

VERSION="$1"
NOTES="${2:-Release v${VERSION}}"

# ---------------------------------------------------------------------------
# Required environment variable validation
# ---------------------------------------------------------------------------
MISSING=()
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID R2_BUCKET R2_PUBLIC_URL; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: The following required environment variables are not set:" >&2
  for var in "${MISSING[@]}"; do
    echo "  - $var" >&2
  done
  exit 1
fi

# wrangler reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID automatically;
# no `wrangler login` / `wrangler config` step needed.
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

# ---------------------------------------------------------------------------
# Artifacts directories
# ---------------------------------------------------------------------------
ARTIFACTS_DIR="${ARTIFACTS_DIR:-.}"
UPDATER_DIR="${UPDATER_DIR:-$ARTIFACTS_DIR}"
INSTALLER_DIR="${INSTALLER_DIR:-}"

# Strip trailing slash from public URL
R2_PUBLIC_URL="${R2_PUBLIC_URL%/}"

echo "============================================================"
echo "Publishing Meridian Desktop v${VERSION}"
echo "Updater dir   : ${UPDATER_DIR}"
echo "Installer dir : ${INSTALLER_DIR:-<none>}"
echo "Bucket        : ${R2_BUCKET}"
echo "Public URL    : ${R2_PUBLIC_URL}"
echo "============================================================"

# ---------------------------------------------------------------------------
# Tiny upload helper. Wraps `wrangler r2 object put` with consistent flags:
#   $1 = local file path
#   $2 = remote key inside the bucket
#   $3 = (optional) cache-control value, default ""
#   $4 = (optional) content-type, default auto-detected by wrangler
# ---------------------------------------------------------------------------
r2_upload() {
  local src="$1"
  local key="$2"
  local cache="${3:-}"
  local mime="${4:-}"

  local args=(
    r2 object put "${R2_BUCKET}/${key}"
    --file="${src}"
    --remote
  )
  if [[ -n "$cache" ]]; then args+=(--cache-control="${cache}"); fi
  if [[ -n "$mime" ]]; then args+=(--content-type="${mime}"); fi

  bunx wrangler "${args[@]}" >/dev/null
}

# ---------------------------------------------------------------------------
# Platform targets. Plain indexed array — macOS default bash (3.2) doesn't
# support `declare -A`, and the only thing we'd map per-target right now
# is the display name + globs, both trivial to derive in a case statement.
# ---------------------------------------------------------------------------
TARGETS=(
  aarch64-apple-darwin
  x86_64-apple-darwin
)

# platform_meta <target> → echoes "<platform_key>|<artifact_glob>|<installer_glob>"
platform_meta() {
  case "$1" in
    aarch64-apple-darwin) echo "darwin-aarch64|*.app.tar.gz|*.dmg" ;;
    x86_64-apple-darwin)  echo "darwin-x86_64|*.app.tar.gz|*.dmg" ;;
    *) echo "ERROR: unknown target $1" >&2; return 1 ;;
  esac
}

# Accumulate uploaded file keys for the summary
UPLOADED=()

# ---------------------------------------------------------------------------
# Walk updater artifact directories, upload, and collect platform metadata
# ---------------------------------------------------------------------------
PLATFORMS_JSON="{}"
UPLOAD_COUNT=0

for TARGET in "${TARGETS[@]}"; do
  TARGET_DIR="${UPDATER_DIR}/${TARGET}"

  if [[ ! -d "$TARGET_DIR" ]]; then
    echo "WARN: directory not found, skipping target: ${TARGET_DIR}" >&2
    continue
  fi

  IFS='|' read -r PLATFORM GLOB _ <<< "$(platform_meta "$TARGET")"

  # find ... | head -1 — `mapfile` is bash 4+, skip the array.
  ARTIFACT="$(find "$TARGET_DIR" -maxdepth 1 -name "$GLOB" ! -name "*.sig" 2>/dev/null | sort | head -1)"
  if [[ -z "$ARTIFACT" ]]; then
    echo "WARN: no artifact matching '${GLOB}' found in ${TARGET_DIR}, skipping." >&2
    continue
  fi
  SIG_FILE="${ARTIFACT}.sig"

  if [[ ! -f "$SIG_FILE" ]]; then
    echo "WARN: signature file not found: ${SIG_FILE}, skipping platform ${PLATFORM}." >&2
    continue
  fi

  ARTIFACT_BASENAME="$(basename "$ARTIFACT")"
  DEST_KEY="v${VERSION}/${ARTIFACT_BASENAME}"
  PUBLIC_URL="${R2_PUBLIC_URL}/${DEST_KEY}"
  SIGNATURE="$(cat "$SIG_FILE")"

  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}"
  r2_upload "$ARTIFACT" "$DEST_KEY"

  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}.sig"
  r2_upload "$SIG_FILE" "${DEST_KEY}.sig"

  UPLOADED+=("${DEST_KEY}" "${DEST_KEY}.sig")
  UPLOAD_COUNT=$((UPLOAD_COUNT + 1))

  PLATFORMS_JSON="$(
    jq -n \
      --argjson existing "$PLATFORMS_JSON" \
      --arg platform "$PLATFORM" \
      --arg signature "$SIGNATURE" \
      --arg url "$PUBLIC_URL" \
      '$existing + {($platform): {"signature": $signature, "url": $url}}'
  )"
done

if [[ $UPLOAD_COUNT -eq 0 ]]; then
  echo "ERROR: No updater artifacts were found or uploaded. Aborting." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build + upload latest.json
# ---------------------------------------------------------------------------
PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

LATEST_JSON="$(
  jq -n \
    --arg version "$VERSION" \
    --arg notes "$NOTES" \
    --arg pub_date "$PUB_DATE" \
    --argjson platforms "$PLATFORMS_JSON" \
    '{
      version:   $version,
      notes:     $notes,
      pub_date:  $pub_date,
      platforms: $platforms
    }'
)"

echo "$LATEST_JSON" > /tmp/latest.json
echo ""
echo "Generated latest.json:"
echo "$LATEST_JSON"
echo ""

echo "Uploading latest.json to bucket root..."
r2_upload /tmp/latest.json "latest.json" "max-age=60" "application/json"
UPLOADED+=("latest.json")

# ---------------------------------------------------------------------------
# Upload installer artifacts (DMG for direct download)
# ---------------------------------------------------------------------------
INSTALLER_COUNT=0

if [[ -n "$INSTALLER_DIR" ]]; then
  echo ""
  echo "------------------------------------------------------------"
  echo "Uploading installer artifacts..."
  echo "------------------------------------------------------------"

  for TARGET in "${TARGETS[@]}"; do
    TARGET_DIR="${INSTALLER_DIR}/${TARGET}"

    if [[ ! -d "$TARGET_DIR" ]]; then
      echo "WARN: installer directory not found, skipping: ${TARGET_DIR}" >&2
      continue
    fi

    IFS='|' read -r PLATFORM _ GLOB <<< "$(platform_meta "$TARGET")"

    INSTALLER="$(find "$TARGET_DIR" -maxdepth 1 -name "$GLOB" ! -name "*.sig" 2>/dev/null | sort | head -1)"
    if [[ -z "$INSTALLER" ]]; then
      echo "WARN: no installer matching '${GLOB}' found in ${TARGET_DIR}, skipping." >&2
      continue
    fi

    INSTALLER_BASENAME="$(basename "$INSTALLER")"
    DEST_KEY="v${VERSION}/installers/${INSTALLER_BASENAME}"

    echo "Uploading installer [${PLATFORM}]: ${INSTALLER_BASENAME}"
    r2_upload "$INSTALLER" "$DEST_KEY"

    # Stable URL at the bucket root so end users have one link that never
    # changes between releases. no-cache lets new releases propagate at
    # Cloudflare's edge immediately.
    EXT="${INSTALLER_BASENAME##*.}"
    STABLE_KEY="Meridian-${PLATFORM}.${EXT}"
    echo "Mirroring stable URL [${PLATFORM}]: ${STABLE_KEY}"
    r2_upload "$INSTALLER" "$STABLE_KEY" "no-cache"

    UPLOADED+=("${DEST_KEY}" "${STABLE_KEY}")
    INSTALLER_COUNT=$((INSTALLER_COUNT + 1))
  done

  echo "Uploaded ${INSTALLER_COUNT} installer artifact(s)."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "Publish complete — v${VERSION}"
echo "------------------------------------------------------------"
for item in "${UPLOADED[@]}"; do
  echo "  ${R2_PUBLIC_URL}/${item}"
done
echo ""
echo "Updater endpoint:"
echo "  ${R2_PUBLIC_URL}/latest.json"
if [[ $INSTALLER_COUNT -gt 0 ]]; then
  echo ""
  echo "Stable download URLs (share these with users):"
  for TARGET in "${TARGETS[@]}"; do
    TARGET_DIR="${INSTALLER_DIR}/${TARGET}"
    [[ -d "$TARGET_DIR" ]] || continue
    IFS='|' read -r PLATFORM _ GLOB <<< "$(platform_meta "$TARGET")"
    INSTALLER="$(find "$TARGET_DIR" -maxdepth 1 -name "$GLOB" ! -name "*.sig" 2>/dev/null | sort | head -1)"
    [[ -n "$INSTALLER" ]] || continue
    EXT="${INSTALLER##*.}"
    echo "  ${R2_PUBLIC_URL}/Meridian-${PLATFORM}.${EXT}"
  done
fi
echo "============================================================"
