#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# publish-desktop.sh
# Called by CI after all platform builds complete.
# Uploads Tauri updater artifacts to any S3-compatible object storage
# and publishes latest.json for the Tauri updater endpoint.
#
# Usage:
#   publish-desktop.sh <VERSION> [NOTES]
#
# Required env vars:
#   S3_ACCESS_KEY_ID      - S3 access key
#   S3_SECRET_ACCESS_KEY  - S3 secret key
#   S3_ENDPOINT_URL       - S3 endpoint (e.g. https://acct.r2.cloudflarestorage.com)
#   S3_BUCKET             - Bucket name
#   S3_PUBLIC_URL         - Public base URL for the bucket (e.g. https://releases.example.com)
#
# Optional env vars:
#   S3_REGION             - Region (default: auto)
#   ARTIFACTS_DIR         - Directory containing build artifacts (default: .)
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
for var in S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_ENDPOINT_URL S3_BUCKET S3_PUBLIC_URL; do
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

S3_REGION="${S3_REGION:-auto}"

# ---------------------------------------------------------------------------
# Configure AWS CLI with S3-compatible credentials
# ---------------------------------------------------------------------------
aws configure set aws_access_key_id     "$S3_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$S3_SECRET_ACCESS_KEY"
aws configure set default.region        "$S3_REGION"

# ---------------------------------------------------------------------------
# Artifacts directory (default: current directory)
# ---------------------------------------------------------------------------
ARTIFACTS_DIR="${ARTIFACTS_DIR:-.}"

# Strip trailing slash from public URL
S3_PUBLIC_URL="${S3_PUBLIC_URL%/}"

echo "============================================================"
echo "Publishing Meridian Desktop v${VERSION}"
echo "Artifacts dir : ${ARTIFACTS_DIR}"
echo "Bucket        : ${S3_BUCKET}"
echo "Endpoint      : ${S3_ENDPOINT_URL}"
echo "Public URL    : ${S3_PUBLIC_URL}"
echo "============================================================"

# ---------------------------------------------------------------------------
# Platform target → (platform key, artifact glob) mapping
# ---------------------------------------------------------------------------
declare -A PLATFORM_KEY=(
  [aarch64-apple-darwin]="darwin-aarch64"
  [x86_64-apple-darwin]="darwin-x86_64"
  [x86_64-unknown-linux-gnu]="linux-x86_64"
  [aarch64-unknown-linux-gnu]="linux-aarch64"
  [x86_64-pc-windows-msvc]="windows-x86_64"
)

declare -A ARTIFACT_GLOB=(
  [aarch64-apple-darwin]="*.app.tar.gz"
  [x86_64-apple-darwin]="*.app.tar.gz"
  [x86_64-unknown-linux-gnu]="*.AppImage"
  [aarch64-unknown-linux-gnu]="*.AppImage"
  [x86_64-pc-windows-msvc]="*-setup.exe"
)

# Accumulate uploaded file basenames for the summary
UPLOADED=()

# ---------------------------------------------------------------------------
# Walk artifact directories, upload, and collect platform metadata
# ---------------------------------------------------------------------------
PLATFORMS_JSON="{}"
UPLOAD_COUNT=0

for TARGET in "${!PLATFORM_KEY[@]}"; do
  TARGET_DIR="${ARTIFACTS_DIR}/${TARGET}"

  if [[ ! -d "$TARGET_DIR" ]]; then
    echo "WARN: directory not found, skipping target: ${TARGET_DIR}" >&2
    continue
  fi

  GLOB="${ARTIFACT_GLOB[$TARGET]}"
  PLATFORM="${PLATFORM_KEY[$TARGET]}"

  # Find the artifact file (expect exactly one match)
  mapfile -t MATCHES < <(find "$TARGET_DIR" -maxdepth 1 -name "$GLOB" ! -name "*.sig" 2>/dev/null | sort)

  if [[ ${#MATCHES[@]} -eq 0 ]]; then
    echo "WARN: no artifact matching '${GLOB}' found in ${TARGET_DIR}, skipping." >&2
    continue
  fi

  if [[ ${#MATCHES[@]} -gt 1 ]]; then
    echo "WARN: multiple artifacts matching '${GLOB}' in ${TARGET_DIR}, using the first one." >&2
  fi

  ARTIFACT="${MATCHES[0]}"
  SIG_FILE="${ARTIFACT}.sig"

  if [[ ! -f "$SIG_FILE" ]]; then
    echo "WARN: signature file not found: ${SIG_FILE}, skipping platform ${PLATFORM}." >&2
    continue
  fi

  ARTIFACT_BASENAME="$(basename "$ARTIFACT")"
  DEST_KEY="v${VERSION}/${ARTIFACT_BASENAME}"
  PUBLIC_URL="${S3_PUBLIC_URL}/${DEST_KEY}"
  SIGNATURE="$(cat "$SIG_FILE")"

  # Upload artifact
  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}"
  aws s3 cp "$ARTIFACT" "s3://${S3_BUCKET}/${DEST_KEY}" \
    --endpoint-url "$S3_ENDPOINT_URL"

  # Upload .sig file alongside the artifact
  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}.sig"
  aws s3 cp "$SIG_FILE" "s3://${S3_BUCKET}/${DEST_KEY}.sig" \
    --endpoint-url "$S3_ENDPOINT_URL"

  UPLOADED+=("${DEST_KEY}" "${DEST_KEY}.sig")
  UPLOAD_COUNT=$((UPLOAD_COUNT + 1))

  # Build platforms JSON incrementally
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
  echo "ERROR: No artifacts were found or uploaded. Aborting." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build latest.json
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

# ---------------------------------------------------------------------------
# Upload latest.json to bucket root
# ---------------------------------------------------------------------------
echo "Uploading latest.json to bucket root..."
aws s3 cp /tmp/latest.json "s3://${S3_BUCKET}/latest.json" \
  --endpoint-url "$S3_ENDPOINT_URL" \
  --cache-control "max-age=60"

UPLOADED+=("latest.json")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "Publish complete — v${VERSION}"
echo "------------------------------------------------------------"
for item in "${UPLOADED[@]}"; do
  echo "  s3://${S3_BUCKET}/${item}"
done
echo ""
echo "Updater endpoint:"
echo "  ${S3_PUBLIC_URL}/latest.json"
echo "============================================================"
