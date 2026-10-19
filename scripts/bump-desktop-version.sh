#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-}"

if [[ -z "${VERSION}" ]]; then
  echo "Error: version argument is required." >&2
  echo "Usage: $(basename "$0") <X.Y.Z>" >&2
  exit 1
fi

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version '${VERSION}' does not match semver pattern X.Y.Z" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is not installed. Please install jq to continue." >&2
  exit 1
fi

export BUMP_VERSION="${VERSION}"

TAURI_CONF="${REPO_ROOT}/apps/desktop/src-tauri/tauri.conf.json"
CARGO_TOML="${REPO_ROOT}/apps/desktop/src-tauri/Cargo.toml"
PKG_JSON="${REPO_ROOT}/apps/desktop/package.json"

# Update tauri.conf.json
tmp="$(mktemp)"
jq --arg v "${VERSION}" '.version = $v' "${TAURI_CONF}" > "${tmp}"
mv "${tmp}" "${TAURI_CONF}"
echo "Updated ${TAURI_CONF}  →  version = \"${VERSION}\""

# Update Cargo.toml (first occurrence of version = "..." in the [package]
# section). perl, not sed: BSD sed on macOS silently ignores the `0,/re/`
# range, which left Cargo.toml stuck on an old version for several releases.
perl -pi -e 'BEGIN { $done = 0 } if (!$done && s/^version = "[^"]+"/version = "$ENV{BUMP_VERSION}"/) { $done = 1 }' "${CARGO_TOML}"
echo "Updated ${CARGO_TOML}  →  version = \"${VERSION}\""

# Update package.json
tmp="$(mktemp)"
jq --arg v "${VERSION}" '.version = $v' "${PKG_JSON}" > "${tmp}"
mv "${tmp}" "${PKG_JSON}"
echo "Updated ${PKG_JSON}  →  version = \"${VERSION}\""
