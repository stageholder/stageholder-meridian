// apps/mobile/lib/api/Provider.tsx
//
// QueryProvider — provides the app's single in-memory QueryClient. (Cache
// persistence to AsyncStorage was removed 2026-07-23 — see query-client.ts.)
//
// Three responsibilities:
//   1. Provide the QueryClient
//   2. Bridge `useAccessToken()` from @stageholder/sdk/react-native into
//      the module-level Axios interceptor (see ./auth.ts for why)
//   3. Forward 401 events from the API client to the consumer's router
//      (onUnauthorized). (402/paywall is handled directly by <PaywallHost>,
//      which listens to the same DeviceEventEmitter event — see app/_layout.)
//
// The provider sits INSIDE <StageholderProvider> in the layout tree so
// `useAccessToken()` is in scope — see app/_layout.tsx.

import { useAccessToken } from "@stageholder/sdk/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { DeviceEventEmitter } from "react-native";

import { setAccessTokenAccessor } from "./auth";
import { ClientEvents } from "./client";
import { queryClient } from "./query-client";

export type QueryProviderProps = {
  children: ReactNode;
  /**
   * Fired when any API call returns 401. NON-DESTRUCTIVE observation hook only
   * (telemetry, a soft "reconnecting" hint) — do NOT purge the session or
   * redirect from here. A 401 does not prove the session is dead: it may be a
   * transient mid-refresh race. Terminal session death is owned exclusively by
   * the SDK's `onAuthError` (StageholderProvider in app/_layout.tsx), which
   * fires only on a real `invalid_grant`. Inferring teardown from a 401 forced
   * a spurious re-login on network blips (removed with @stageholder/sdk
   * alpha.60). Currently left unwired.
   */
  onUnauthorized?: () => void;
};

export function QueryProvider({
  children,
  onUnauthorized,
}: QueryProviderProps) {
  // Bridge the 401 DeviceEventEmitter event into a React-land callback. Re-arm
  // on every handler change — useEffect cleanup detaches the old listener,
  // fresh subscribe attaches the new one. (402/paywall has its own listener in
  // <PaywallHost>, so it isn't forwarded here.)
  useEffect(() => {
    if (!onUnauthorized) return;
    const sub = DeviceEventEmitter.addListener(
      ClientEvents.unauthorized,
      () => {
        onUnauthorized();
      },
    );
    return () => sub.remove();
  }, [onUnauthorized]);

  return (
    // Plain in-memory QueryClient — cache persistence was REMOVED 2026-07-23
    // (see query-client.ts header): the smooth sibling apps (almanac/atlas
    // mobile, same stack) don't persist, and the persister was a standing
    // JS-thread tax (boot rehydration + stringify bursts) plus a class of
    // wrong-shape-rehydrate bugs. This also retires the journal-plaintext
    // dehydrate exclusion wholesale — nothing is written to disk at all.
    <QueryClientProvider client={queryClient}>
      <AuthTokenBridge />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Reads the SDK's `useAccessToken()` accessor and plants it into the
 * module-level token getter (`./auth.ts`) so the Axios request interceptor
 * can call it from outside the React tree.
 *
 * Renders nothing. Just an effect that runs once on mount + on accessor
 * change. Unmount resets the accessor to a null-returning fallback so
 * stale closures don't leak after sign-out.
 */
function AuthTokenBridge() {
  const { getAccessToken } = useAccessToken();
  useEffect(() => {
    setAccessTokenAccessor(getAccessToken);
    return () => setAccessTokenAccessor(null);
  }, [getAccessToken]);
  return null;
}
