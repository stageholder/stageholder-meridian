#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# desktop-release-notes.sh <VERSION>
# Prints the `## <VERSION>` section of apps/desktop/CHANGELOG.md (the lines
# down to the next `## `, blank edges trimmed). Exits 1 with no output when
# the file or the section is missing. Used by local-publish-desktop.sh (to
# preview + gate before the build) and publish-desktop.sh (latest.json notes,
# which the app shows under "What's new" before the user downloads).
# ---------------------------------------------------------------------------

VERSION="${1:?usage: $(basename "$0") <VERSION>}"
CHANGELOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/apps/desktop/CHANGELOG.md"
[[ -f "$CHANGELOG" ]] || exit 1

NOTES="$(awk -v v="$VERSION" '
  /^## / { if (p) exit; p = ($2 == v || $2 == "v" v); next }
  p { buf[n++] = $0 }
  END {
    s = 0; while (s < n && buf[s] ~ /^[[:space:]]*$/) s++
    e = n - 1; while (e >= s && buf[e] ~ /^[[:space:]]*$/) e--
    for (i = s; i <= e; i++) print buf[i]
  }' "$CHANGELOG")"

[[ -n "$NOTES" ]] || exit 1
printf '%s\n' "$NOTES"
