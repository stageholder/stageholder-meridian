#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# build-desktop.sh
# Thin wrapper around `turbo run build --filter=desktop` that auto-loads the
# Tauri updater signing key from the conventional path (~/.tauri/meridian.*).
#
# Why: tauri.conf.json has a pubkey + createUpdaterArtifacts: true, so the
# build always tries to sign the updater .tar.gz at the end. Without the
# signing env vars set, Tauri still produces a usable .app / .dmg but then
# errors out, leaving the overall script with a non-zero exit code. Loading
# the key here lets `bun build:desktop` succeed end-to-end for local checks.
#
# Keys missing? The build still runs — it just errors at the very end on the
# updater step. Use this script for verification builds; use
# `bun publish:desktop` for actual releases.
# ---------------------------------------------------------------------------

KEY_FILE="${HOME}/.tauri/meridian.key"
PW_FILE="${HOME}/.tauri/meridian.key.password"

if [[ -f "$KEY_FILE" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
else
  echo "WARN: $KEY_FILE not found. Updater signing will fail at the end of the build." >&2
  echo "      The .app/.dmg will still be produced. Generate a key with:" >&2
  echo "      bun --filter=desktop run tauri signer generate -w ~/.tauri/meridian.key -p <password>" >&2
fi

if [[ -f "$PW_FILE" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat "$PW_FILE")"
fi

exec turbo run build --filter=desktop "$@"
