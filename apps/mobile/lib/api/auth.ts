// apps/mobile/lib/api/auth.ts
//
// Bridge between the SDK's React-hook-based `useAccessToken()` and our
// module-level Axios request interceptor.
//
// The SDK (alpha.44+) exposes the token accessor via a hook because it
// needs provider context to refresh, decode, and mutex concurrent calls.
// Our Axios interceptor runs in module scope (no React tree available),
// so we plant the hook's `getAccessToken` into a module-level ref and
// let the interceptor read it from there.
//
// Wiring lives in `./Provider.tsx`'s `<AuthTokenBridge />` — it calls
// `useAccessToken()` inside the SDK provider, then plants the function
// here via `setAccessTokenAccessor()`. Until that component mounts, the
// fallback returns null and requests go unauthenticated (the 401
// interceptor then fires `meridian:unauthorized`).
//
// Cleanup on unmount resets the accessor — important so a stray interceptor
// call after sign-out doesn't try to use a stale token-fetch closure.

export type GetAccessToken = () => Promise<string | null>;

let _getAccessToken: GetAccessToken = async () => null;

/** Called by `<AuthTokenBridge />` when the SDK's hook returns its accessor. */
export function setAccessTokenAccessor(fn: GetAccessToken | null): void {
  _getAccessToken = fn ?? (async () => null);
}

/**
 * Module-level token fetcher used by the Axios request interceptor.
 * Returns a fresh token (auto-refreshed by the SDK if within its refresh
 * window) or null when no user is signed in.
 */
export const getAccessToken: GetAccessToken = () => _getAccessToken();
