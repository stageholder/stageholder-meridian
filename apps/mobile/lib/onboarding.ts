// apps/mobile/lib/onboarding.ts
//
// Per-account onboarding completion flag, backed by expo-secure-store so
// it survives app restarts but not reinstalls. Reinstall-as-fresh-start is
// intentional — gives returning users a "welcome back" moment.
//
// Key shape: `meridian_onboarded_<sub>` so multiple accounts on one device
// each get their own flag (matches the per-account isolation pattern used
// for Dexie userSub scoping on the PWA side).
//
// Underscores (not colons) as separators: expo-secure-store rejects any
// key with characters outside [A-Za-z0-9_-]. Colons throw "Invalid key
// provided to SecureStore" at runtime — silently broke the markOnboarded
// step at the end of the onboarding flow.

import * as SecureStore from "expo-secure-store";

function keyFor(sub: string): string {
  return `meridian_onboarded_${sub}`;
}

export async function isOnboarded(sub: string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(keyFor(sub));
    return v === "1";
  } catch {
    // SecureStore can throw on first launch before the keychain is ready.
    // Treat as not-onboarded — the worst case is a one-time replay of the
    // welcome flow, which is acceptable.
    return false;
  }
}

export async function markOnboarded(sub: string): Promise<void> {
  await SecureStore.setItemAsync(keyFor(sub), "1");
}

export async function resetOnboarded(sub: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(sub));
}
