/**
 * Module-level cache of the current user's OIDC `sub`. Populated from
 * the session initializer once `useUser()` resolves, and cleared on
 * sign-out. Non-React modules (offline mutation queue, sync manager,
 * entitlement cache) read from here to avoid prop-drilling.
 */
let cached: string | null = null;

export function setCurrentUserSub(sub: string | null): void {
  cached = sub;
}

export function getCurrentUserSub(): string {
  if (!cached) {
    throw new Error("No current user sub — call setCurrentUserSub after login");
  }
  return cached;
}

/**
 * Non-throwing variant for code paths that must tolerate an unknown user
 * (e.g. pre-hydration server renders). Prefer `getCurrentUserSub` in
 * client code after the session is known.
 */
export function tryGetCurrentUserSub(): string | null {
  return cached;
}
