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

TAURI_CONF="${REPO_ROOT}/apps/desktop/src-tauri/tauri.conf.json"
CARGO_TOML="${REPO_ROOT}/apps/desktop/src-tauri/Cargo.toml"
PKG_JSON="${REPO_ROOT}/apps/desktop/package.json"

# Update tauri.conf.json
tmp="$(mktemp)"
jq --arg v "${VERSION}" '.version = $v' "${TAURI_CONF}" > "${tmp}"
mv "${tmp}" "${TAURI_CONF}"
echo "Updated ${TAURI_CONF}  →  version = \"${VERSION}\""

# Update Cargo.toml (first occurrence of version = "..." in the [package] section)
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' -E "0,/^version = \"[^\"]+\"/s//version = \"${VERSION}\"/" "${CARGO_TOML}"
else
  sed -i -E "0,/^version = \"[^\"]+\"/s//version = \"${VERSION}\"/" "${CARGO_TOML}"
fi
echo "Updated ${CARGO_TOML}  →  version = \"${VERSION}\""

# Update package.json
tmp="$(mktemp)"
jq --arg v "${VERSION}" '.version = $v' "${PKG_JSON}" > "${tmp}"
mv "${tmp}" "${PKG_JSON}"
echo "Updated ${PKG_JSON}  →  version = \"${VERSION}\""
