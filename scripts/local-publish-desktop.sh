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
#   bun publish:desktop                      # next PATCH (0.2.7 → 0.2.8), notes from apps/desktop/CHANGELOG.md
#   bun publish:desktop --minor              # next MINOR (0.2.7 → 0.3.0)
#   bun publish:desktop --major              # next MAJOR
#   bun publish:desktop 1.0.0 "Big release"  # explicit version + notes
#   bun publish:desktop:dry                  # build + stage only, no upload
#
#   scripts/local-publish-desktop.sh [VERSION] [NOTES]
#     [--patch|--minor|--major]  Bump from apps/desktop/src-tauri/tauri.conf.json
#                           when no VERSION is given (default: --patch)
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
BUMP_KIND="patch"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --no-bump) DO_BUMP=0; shift ;;
    --no-upload) DO_UPLOAD=0; shift ;;
    --patch) BUMP_KIND="patch"; shift ;;
    --minor) BUMP_KIND="minor"; shift ;;
    --major) BUMP_KIND="major"; shift ;;
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

# ---------------------------------------------------------------------------
# Version: explicit, or the next patch/minor/major from tauri.conf.json so a
# bare `bun publish:desktop` ships the next release without arguments.
# With --no-bump and no VERSION, re-publish the current version.
# ---------------------------------------------------------------------------
CURRENT_VERSION="$(jq -r '.version' "${REPO_ROOT}/apps/desktop/src-tauri/tauri.conf.json")"
if [[ -z "$VERSION" ]]; then
  if [[ $DO_BUMP -eq 0 ]]; then
    VERSION="$CURRENT_VERSION"
  else
    IFS=. read -r MAJ MIN PAT <<<"$CURRENT_VERSION"
    case "$BUMP_KIND" in
      major) VERSION="$((MAJ + 1)).0.0" ;;
      minor) VERSION="${MAJ}.$((MIN + 1)).0" ;;
      *)     VERSION="${MAJ}.${MIN}.$((PAT + 1))" ;;
    esac
    echo "No version given — bumping ${BUMP_KIND}: ${CURRENT_VERSION} → ${VERSION}"
  fi
fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: version '${VERSION}' is not X.Y.Z" >&2
  exit 1
fi

# Empty NOTES → publish-desktop.sh uses this version's section of
# apps/desktop/CHANGELOG.md (shown in the app's update dialog).

# ---------------------------------------------------------------------------
# Tooling pre-flight — fail fast before a 10-minute build.
# ---------------------------------------------------------------------------
for tool in jq rustc cargo bun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: '$tool' is required but not installed." >&2
    exit 1
  fi
done
if [[ $DO_UPLOAD -eq 1 ]] && ! command -v wrangler >/dev/null 2>&1; then
  echo "ERROR: 'wrangler' (Cloudflare CLI) is required to upload: bun add -g wrangler" >&2
  exit 1
fi
if [[ "$(uname -s)" == "Darwin" ]] && ! xcrun -f notarytool >/dev/null 2>&1; then
  echo "WARN: Xcode command line tools not found — the DMG will not be notarized." >&2
fi

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
echo "  Notes   : ${NOTES:-(apps/desktop/CHANGELOG.md, section ${VERSION})}"
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
# Notarize + staple the DMG (macOS, Developer ID only). Tauri notarizes and
# staples the .app, but the DMG that wraps it is only signed — Gatekeeper
# assesses a downloaded disk image as "Unnotarized Developer ID" and can warn
# on open. notarytool accepts the .dmg directly; stapling it means the check
# also passes offline. Skipped when the Apple credentials are not set
# (ad-hoc build) or no DMG was produced.
# ---------------------------------------------------------------------------
BUNDLE_DIR="${REPO_ROOT}/apps/desktop/src-tauri/target/${TARGET}/release/bundle"
if [[ $DO_UPLOAD -eq 1 && ( -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ) ]]; then
  echo "WARN: APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID not set in .env.publish — publishing an UN-notarized DMG (Gatekeeper will warn users)." >&2
fi
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  DMG_TO_NOTARIZE="$(find "${BUNDLE_DIR}/dmg" -maxdepth 1 -name "*.dmg" 2>/dev/null | head -1)"
  if [[ -n "${DMG_TO_NOTARIZE}" ]]; then
    echo ""
    echo "Notarizing DMG: ${DMG_TO_NOTARIZE}"
    xcrun notarytool submit "${DMG_TO_NOTARIZE}" \
      --apple-id "${APPLE_ID}" --team-id "${APPLE_TEAM_ID}" \
      --password "${APPLE_PASSWORD}" --wait
    xcrun stapler staple "${DMG_TO_NOTARIZE}"
    spctl -a -vv -t open --context context:primary-signature "${DMG_TO_NOTARIZE}"
  fi
fi

# ---------------------------------------------------------------------------
# Stage artifacts in the layout publish-desktop.sh expects:
#   out/updater/<target>/*.app.tar.gz + .sig (or .AppImage / -setup.exe + .sig)
#   out/installer/<target>/*.dmg | *.deb | *-setup.exe
# ---------------------------------------------------------------------------
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
  echo "============================================================"
  echo "Published v${VERSION} → ${R2_PUBLIC_URL:-R2}/latest.json"
  echo "Installed apps update on next launch; the DMG is in ${STAGE_ROOT}/installer."
  echo "Version files changed (commit them): apps/desktop/src-tauri/tauri.conf.json,"
  echo "  apps/desktop/src-tauri/Cargo.toml, apps/desktop/package.json"
  echo "  e.g.  git add apps/desktop && git commit -m \"chore(desktop): release v${VERSION}\" && git tag desktop-v${VERSION}"
  echo "Local staging kept at ${STAGE_ROOT} — delete when you're done verifying."
  echo "============================================================"
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
