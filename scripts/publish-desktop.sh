#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# publish-desktop.sh
# Called by CI after all platform builds complete.
# Uploads Tauri updater artifacts to Vultr Object Storage and publishes
# latest.json for the Tauri updater endpoint.
#
# Usage:
#   publish-desktop.sh <VERSION> [NOTES]
#
# Required env vars:
#   VULTR_OBJ_ACCESS_KEY
#   VULTR_OBJ_SECRET_KEY
#   VULTR_OBJ_REGION
#   VULTR_OBJ_BUCKET
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
for var in VULTR_OBJ_ACCESS_KEY VULTR_OBJ_SECRET_KEY VULTR_OBJ_REGION VULTR_OBJ_BUCKET; do
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

# ---------------------------------------------------------------------------
# Configure AWS CLI with Vultr credentials
# ---------------------------------------------------------------------------
aws configure set aws_access_key_id     "$VULTR_OBJ_ACCESS_KEY"
aws configure set aws_secret_access_key "$VULTR_OBJ_SECRET_KEY"
aws configure set default.region        "$VULTR_OBJ_REGION"

ENDPOINT="https://${VULTR_OBJ_REGION}.vultrobjects.com"

# ---------------------------------------------------------------------------
# Artifacts directory (default: current directory)
# ---------------------------------------------------------------------------
ARTIFACTS_DIR="${ARTIFACTS_DIR:-.}"

echo "============================================================"
echo "Publishing Meridian Desktop v${VERSION}"
echo "Artifacts dir : ${ARTIFACTS_DIR}"
echo "Bucket        : ${VULTR_OBJ_BUCKET}"
echo "Endpoint      : ${ENDPOINT}"
echo "============================================================"

# ---------------------------------------------------------------------------
# Platform target → (platform key, artifact glob) mapping
# ---------------------------------------------------------------------------
declare -A PLATFORM_KEY=(
  [aarch64-apple-darwin]="darwin-aarch64"
  [x86_64-apple-darwin]="darwin-x86_64"
  [x86_64-unknown-linux-gnu]="linux-x86_64"
  [x86_64-pc-windows-msvc]="windows-x86_64"
)

declare -A ARTIFACT_GLOB=(
  [aarch64-apple-darwin]="*.app.tar.gz"
  [x86_64-apple-darwin]="*.app.tar.gz"
  [x86_64-unknown-linux-gnu]="*.AppImage.tar.gz"
  [x86_64-pc-windows-msvc]="*-setup.nsis.zip"
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
  PUBLIC_URL="https://${VULTR_OBJ_BUCKET}.${VULTR_OBJ_REGION}.vultrobjects.com/${DEST_KEY}"
  SIGNATURE="$(cat "$SIG_FILE")"

  # Upload artifact
  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}"
  aws s3 cp "$ARTIFACT" "s3://${VULTR_OBJ_BUCKET}/${DEST_KEY}" \
    --endpoint-url "$ENDPOINT" \
    --acl public-read

  # Upload .sig file alongside the artifact
  echo "Uploading [${PLATFORM}]: ${ARTIFACT_BASENAME}.sig"
  aws s3 cp "$SIG_FILE" "s3://${VULTR_OBJ_BUCKET}/${DEST_KEY}.sig" \
    --endpoint-url "$ENDPOINT" \
    --acl public-read

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
aws s3 cp /tmp/latest.json "s3://${VULTR_OBJ_BUCKET}/latest.json" \
  --endpoint-url "$ENDPOINT" \
  --acl public-read \
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
  echo "  s3://${VULTR_OBJ_BUCKET}/${item}"
done
echo ""
echo "Updater endpoint:"
echo "  https://${VULTR_OBJ_BUCKET}.${VULTR_OBJ_REGION}.vultrobjects.com/latest.json"
echo "============================================================"
