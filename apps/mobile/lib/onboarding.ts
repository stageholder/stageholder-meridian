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

// In-memory mirror of the completion flag for the CURRENT session. It exists so
// a SecureStore write failure (keychain locked, device full, OS quirk) can't
// TRAP the user on the final onboarding step: `markOnboarded` always records
// here even when the persistent write throws, and `isOnboarded` consults it, so
// the (authed) gate lets the user through this session. Worst case on a failed
// write is a one-time replay of the welcome flow on the next cold start — never
// a dead-end. Cleared naturally when the process restarts.
const onboardedThisSession = new Set<string>();

export async function isOnboarded(sub: string): Promise<boolean> {
  if (onboardedThisSession.has(sub)) return true;
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
  // Record in-memory FIRST so the flag holds for this session even if the
  // persistent write below fails — the caller must never be blocked from
  // leaving the wizard on a storage hiccup.
  onboardedThisSession.add(sub);
  try {
    await SecureStore.setItemAsync(keyFor(sub), "1");
  } catch {
    // Persistent write failed; the in-memory flag above carries the session.
  }
}

export async function resetOnboarded(sub: string): Promise<void> {
  onboardedThisSession.delete(sub);
  await SecureStore.deleteItemAsync(keyFor(sub));
}
