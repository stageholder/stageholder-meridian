#!/usr/bin/env bash
#
# android-reverse.sh — forward every localhost:PORT the app calls into the
# Android emulator, so OIDC/API requests reach servers running on your Mac.
#
# Why: inside the Android emulator, "localhost" is the emulator, not your host.
# `adb reverse tcp:PORT tcp:PORT` tunnels the emulator's localhost:PORT to the
# host's localhost:PORT — keeping the issuer host as "localhost" (which OIDC
# discovery / token `iss` validation depends on).
#
# Ports are auto-detected from .env.local, so when you add a new connection
# there, just re-run this — nothing to edit here.
#
# Usage:  bun run android:reverse        (run once per emulator boot)
set -euo pipefail

cd "$(dirname "$0")/.."   # apps/mobile
ENV_FILE=".env.local"

# Locate adb (prefer PATH, fall back to the default macOS SDK location).
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
ADB="$(command -v adb || true)"
[ -z "$ADB" ] && [ -x "$SDK/platform-tools/adb" ] && ADB="$SDK/platform-tools/adb"
if [ -z "$ADB" ]; then
  echo "✖ adb not found. Install Android platform-tools or set ANDROID_HOME." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "✖ $ENV_FILE not found (run from apps/mobile)." >&2
  exit 1
fi

# Make sure a device/emulator is actually connected.
if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "✖ No Android device/emulator connected. Boot one, then re-run." >&2
  exit 1
fi

# Ports the app calls directly are auto-detected from the env file
# (e.g. Meridian API, the OIDC issuer).
ENV_PORTS="$(grep -oE '(localhost|127\.0\.0\.1):[0-9]+' "$ENV_FILE" \
             | grep -oE '[0-9]+$' || true)"

# Extra ports the *browser* reaches during the flow but that aren't in the env:
# the OIDC authorize endpoint (:4828) redirects the emulator's system browser to
# the Hub web login UI on :4829, so that port must be tunneled too. Override or
# extend with: ANDROID_REVERSE_EXTRA_PORTS="4829 5000 ..."
EXTRA_PORTS="${ANDROID_REVERSE_EXTRA_PORTS:-4829}"

PORTS="$(printf '%s\n%s\n' "$ENV_PORTS" "$EXTRA_PORTS" | tr ' ' '\n' \
         | grep -E '^[0-9]+$' | sort -un)"

if [ -z "$PORTS" ]; then
  echo "No localhost:PORT URLs found in $ENV_FILE — nothing to reverse."
  exit 0
fi

echo "Reversing ports detected in $ENV_FILE:"
for p in $PORTS; do
  "$ADB" reverse "tcp:$p" "tcp:$p" >/dev/null
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✅ localhost:$p  (host server is up)"
  else
    echo "  ⚠️  localhost:$p  (tunnel set, but NOTHING is listening on host:$p — start that server)"
  fi
done
echo "Done. Retry sign-in in the app."
