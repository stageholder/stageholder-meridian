#!/usr/bin/env bash
#
# android-dev.sh — one command to run the app on Android.
#
# Does the three things you'd otherwise do by hand:
#   1. Boots an emulator if none is connected (uses $ANDROID_AVD or the first AVD).
#   2. Sets up `adb reverse` for every localhost:PORT in .env.local (so OIDC/API
#      requests reach servers on your Mac — see android-reverse.sh for the why).
#   3. Hands off to `expo run:android` (build + install + Metro).
#
# Wired to `bun run android`, so you never run the reverse step manually.
set -euo pipefail

cd "$(dirname "$0")/.."   # apps/mobile

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

ADB="$(command -v adb || true)"
[ -z "$ADB" ] && [ -x "$SDK/platform-tools/adb" ] && ADB="$SDK/platform-tools/adb"
EMU="$(command -v emulator || true)"
[ -z "$EMU" ] && [ -x "$SDK/emulator/emulator" ] && EMU="$SDK/emulator/emulator"

if [ -z "$ADB" ]; then
  echo "✖ adb not found. Install Android platform-tools or set ANDROID_HOME." >&2
  exit 1
fi

# Count fully-ready devices (a booting emulator shows as 'offline', not 'device').
ready_devices() { "$ADB" devices | sed '1d' | grep -cE '[[:space:]]device$' || true; }

# 1. Ensure an emulator/device is connected; boot one if needed.
if [ "$(ready_devices)" -eq 0 ]; then
  # If an emulator is already booting (offline), wait for it instead of starting a 2nd.
  if "$ADB" devices | sed '1d' | grep -qE '[[:space:]]offline$'; then
    echo "An emulator is booting — waiting for it…"
  else
    if [ -z "$EMU" ]; then
      echo "✖ emulator binary not found at $SDK/emulator/emulator." >&2
      echo "  Create an AVD in Android Studio, or connect a device." >&2
      exit 1
    fi
    AVD="${ANDROID_AVD:-$("$EMU" -list-avds | head -n1)}"
    if [ -z "$AVD" ]; then
      echo "✖ No AVD found. Create one in Android Studio → Device Manager." >&2
      exit 1
    fi
    echo "No Android device connected — booting AVD: $AVD"
    nohup "$EMU" -avd "$AVD" >"/tmp/emulator-$AVD.log" 2>&1 &
  fi

  "$ADB" wait-for-device
  printf "Waiting for Android to finish booting"
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    printf "."; sleep 2
  done
  echo " ✅"
fi

# 2. Tunnel the localhost ports the app calls (auto-detected from .env.local).
bash scripts/android-reverse.sh || true

# 3. Resolve the expo binary, then hand off (foreground: build + install + Metro).
EXPO="$(command -v expo || true)"
[ -z "$EXPO" ] && [ -x "node_modules/.bin/expo" ] && EXPO="node_modules/.bin/expo"
if [ -z "$EXPO" ]; then
  echo "✖ expo CLI not found. Run from apps/mobile (deps installed)." >&2
  exit 1
fi
echo "Launching: expo run:android $*"
exec "$EXPO" run:android "$@"
