#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# local-publish-desktop.sh
# One-command desktop release from a local laptop.
#
# Steps:
#   1. Source .env.publish (gitignored) for signing + R2 credentials.
#   2. Bump version in tauri.conf.json + Cargo.toml + package.json.
#   3. Build the Tauri app for the host platform target (Apple Silicon by
#      default; pass --target for cross-builds — only meaningful with a
#      cross-toolchain installed).
#   4. Stage updater + installer artifacts in the layout publish-desktop.sh
#      expects (one subdir per target triple).
#   5. Upload to R2 and publish latest.json.
#
# Usage:
#   scripts/local-publish-desktop.sh <VERSION> [NOTES]
#     [--target <triple>]   Default: detected from `rustc -vV`
#     [--no-bump]           Skip version bump (e.g., re-publish same version)
#     [--no-upload]         Dry run: bump + build + stage but skip R2 upload.
#                           Use to verify the .app/.dmg before going live.
#
# Required env (loaded from .env.publish if present):
#   TAURI_SIGNING_PRIVATE_KEY          # contents of ~/.tauri/meridian.key
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#   S3_ACCESS_KEY_ID
#   S3_SECRET_ACCESS_KEY
#   S3_ENDPOINT_URL
#   S3_BUCKET
#   S3_PUBLIC_URL
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
VERSION=""
NOTES=""
TARGET=""
DO_BUMP=1
DO_UPLOAD=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --no-bump) DO_BUMP=0; shift ;;
    --no-upload) DO_UPLOAD=0; shift ;;
    -h|--help)
      grep -E "^# " "$0" | sed 's/^# //'
      exit 0 ;;
    *)
      if [[ -z "$VERSION" ]]; then VERSION="$1"
      elif [[ -z "$NOTES" ]]; then NOTES="$1"
      else echo "Unexpected arg: $1" >&2; exit 1
      fi
      shift ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Usage: $(basename "$0") <VERSION> [NOTES] [--target <triple>] [--no-bump]" >&2
  exit 1
fi

NOTES="${NOTES:-Release v${VERSION}}"

# ---------------------------------------------------------------------------
# Load credentials from .env.publish (gitignored, never committed)
# ---------------------------------------------------------------------------
ENV_FILE="${REPO_ROOT}/.env.publish"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# ---------------------------------------------------------------------------
# Validate required env. With --no-upload we skip R2 cred checks (you can
# dry-run a build with just the signing key).
# ---------------------------------------------------------------------------
REQUIRED_VARS=(TAURI_SIGNING_PRIVATE_KEY)
if [[ $DO_UPLOAD -eq 1 ]]; then
  REQUIRED_VARS+=(
    CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
    R2_BUCKET R2_PUBLIC_URL
  )
fi

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then MISSING+=("$var"); fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required env vars:" >&2
  for v in "${MISSING[@]}"; do echo "  - $v" >&2; done
  echo "" >&2
  echo "Set them in your shell, or in ${ENV_FILE}" >&2
  echo "(Copy .env.publish.example to .env.publish to start.)" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Detect target triple if not supplied
# ---------------------------------------------------------------------------
if [[ -z "$TARGET" ]]; then
  TARGET="$(rustc -vV | awk '/^host:/ {print $2}')"
  if [[ -z "$TARGET" ]]; then
    echo "ERROR: Could not detect Rust host target. Pass --target <triple>." >&2
    exit 1
  fi
fi

echo "============================================================"
echo "Meridian desktop release"
echo "  Version : ${VERSION}"
echo "  Notes   : ${NOTES}"
echo "  Target  : ${TARGET}"
echo "  Bump    : $([[ $DO_BUMP -eq 1 ]] && echo yes || echo no)"
echo "  Upload  : $([[ $DO_UPLOAD -eq 1 ]] && echo yes || echo 'NO (dry run)')"
echo "============================================================"

# ---------------------------------------------------------------------------
# Bump version (rewrites tauri.conf.json, Cargo.toml, package.json)
# ---------------------------------------------------------------------------
if [[ $DO_BUMP -eq 1 ]]; then
  "${SCRIPT_DIR}/bump-desktop-version.sh" "${VERSION}"
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo ""
echo "Building Tauri app for ${TARGET}..."
( cd "${REPO_ROOT}/apps/desktop" && bun run tauri build --target "${TARGET}" )

# ---------------------------------------------------------------------------
# Stage artifacts in the layout publish-desktop.sh expects:
#   out/updater/<target>/*.app.tar.gz + .sig (or .AppImage / -setup.exe + .sig)
#   out/installer/<target>/*.dmg | *.deb | *-setup.exe
# ---------------------------------------------------------------------------
BUNDLE_DIR="${REPO_ROOT}/apps/desktop/src-tauri/target/${TARGET}/release/bundle"
STAGE_ROOT="${REPO_ROOT}/out/release-${VERSION}"
UPDATER_STAGE="${STAGE_ROOT}/updater/${TARGET}"
INSTALLER_STAGE="${STAGE_ROOT}/installer/${TARGET}"

rm -rf "${STAGE_ROOT}"
mkdir -p "${UPDATER_STAGE}" "${INSTALLER_STAGE}"

# Copy whatever updater + installer artifacts the build produced. Different
# targets land in different subdirs (macos/, deb/, appimage/, nsis/), so a
# `find` sweep is simplest.
find "${BUNDLE_DIR}" -type f \
  \( -name "*.app.tar.gz" -o -name "*.app.tar.gz.sig" \
     -o -name "*.AppImage" -o -name "*.AppImage.sig" \
     -o -name "*-setup.exe.sig" \) \
  -exec cp {} "${UPDATER_STAGE}/" \;

find "${BUNDLE_DIR}" -type f \
  \( -name "*.dmg" -o -name "*.deb" -o -name "*-setup.exe" \) \
  ! -name "*.sig" \
  -exec cp {} "${INSTALLER_STAGE}/" \;

# Windows -setup.exe IS the updater artifact AND the installer — copy to
# updater dir too if we have one. (.dmg is not an updater artifact on macOS;
# the .app.tar.gz is.)
find "${BUNDLE_DIR}" -type f -name "*-setup.exe" ! -name "*.sig" \
  -exec cp {} "${UPDATER_STAGE}/" \;

echo ""
echo "Staged artifacts:"
echo "  Updater   : ${UPDATER_STAGE}"
ls -la "${UPDATER_STAGE}"
echo "  Installer : ${INSTALLER_STAGE}"
ls -la "${INSTALLER_STAGE}"

# ---------------------------------------------------------------------------
# Publish to R2 (skipped under --no-upload)
# ---------------------------------------------------------------------------
if [[ $DO_UPLOAD -eq 1 ]]; then
  echo ""
  UPDATER_DIR="${STAGE_ROOT}/updater" \
  INSTALLER_DIR="${STAGE_ROOT}/installer" \
    "${SCRIPT_DIR}/publish-desktop.sh" "${VERSION}" "${NOTES}"

  echo ""
  echo "Done. Local staging kept at ${STAGE_ROOT} — delete when you're done verifying."
else
  APP_PATH="$(find "${BUNDLE_DIR}/macos" -maxdepth 1 -name "*.app" -type d 2>/dev/null | head -1)"
  DMG_PATH="$(find "${BUNDLE_DIR}/dmg" -maxdepth 1 -name "*.dmg" 2>/dev/null | head -1)"
  cat <<EOF

============================================================
Dry run complete — nothing uploaded.
------------------------------------------------------------
Staged at : ${STAGE_ROOT}
App       : ${APP_PATH:-<not found>}
DMG       : ${DMG_PATH:-<not found>}

Open the .app to verify the build:
  open "${APP_PATH}"

When you're satisfied, re-run without --no-upload (and with
--no-bump if you don't want to bump the version again):
  ${SCRIPT_DIR}/$(basename "$0") ${VERSION} "${NOTES}" --no-bump
============================================================
EOF
fi
