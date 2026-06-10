// apps/mobile/lib/api/Provider.tsx
//
// QueryProvider — wraps the app with React Query's PersistQueryClientProvider
// so the cache survives app relaunches via AsyncStorage. The cache is
// keyed off `meridian.query-cache.v1` (see ./query-client.ts); bump that
// v1 when changing query shapes in a breaking way.
//
// Three responsibilities:
//   1. Provide the QueryClient + cache persistence
//   2. Bridge `useAccessToken()` from @stageholder/sdk/react-native into
//      the module-level Axios interceptor (see ./auth.ts for why)
//   3. Forward 401 / 402 events from the API client to the consumer's
//      router (onUnauthorized) and paywall surface (onPaywall)
//
// The provider sits INSIDE <StageholderProvider> in the layout tree so
// `useAccessToken()` is in scope — see app/_layout.tsx.

import { useAccessToken } from "@stageholder/sdk/react-native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, type ReactNode } from "react";
import { DeviceEventEmitter } from "react-native";

import { setAccessTokenAccessor } from "./auth";
import { ClientEvents } from "./client";
import { queryClient, queryPersister } from "./query-client";

export type QueryProviderProps = {
  children: ReactNode;
  /** Fired when any API call returns 401. Typically navigates to /sign-in. */
  onUnauthorized?: () => void;
  /** Fired when an API call returns 402 with a `limit_reached` body. */
  onPaywall?: (detail: { feature: string; limit: number }) => void;
};

export function QueryProvider({
  children,
  onUnauthorized,
  onPaywall,
}: QueryProviderProps) {
  // Bridge DeviceEventEmitter events into React-land callbacks. Re-arm on
  // every handler change — useEffect cleanup detaches the old listener,
  // fresh subscribe attaches the new one.
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

  useEffect(() => {
    if (!onPaywall) return;
    const sub = DeviceEventEmitter.addListener(
      ClientEvents.paywall,
      (detail: { feature: string; limit: number }) => {
        onPaywall(detail);
      },
    );
    return () => sub.remove();
  }, [onPaywall]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // Buster string — bump when the cache contents need to be
        // invalidated wholesale (e.g. after a major hook refactor).
        // v2: light-events entries were briefly cached as the raw {data,meta}
        // envelope (pre-factory hook); rehydrating that shape crashed the
        // Journey feed before the corrected refetch could land.
        buster: "v2",
      }}
    >
      <AuthTokenBridge />
      {children}
    </PersistQueryClientProvider>
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
