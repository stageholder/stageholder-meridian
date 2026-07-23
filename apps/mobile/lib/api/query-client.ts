// apps/mobile/lib/api/query-client.ts
//
// QueryClient configuration. Defaults mirror the PWA (staleTime: 30s,
// retry: 1) so dev experience is consistent across surfaces.
//
// DELIBERATELY NO CACHE PERSISTENCE. The AsyncStorage persister
// (@tanstack/query-async-storage-persister) was removed 2026-07-23 after a
// comparative audit against the sibling apps (almanac/atlas mobile — same
// Expo/Tamagui/kit stack, measurably smooth): neither persists, and the
// persister was a standing JS-thread tax here — a large JSON.parse +
// hydrate on every cold start, JSON.stringify of the dehydrated cache during
// interaction bursts, plus an entire class of "rehydrated wrong-shape entry
// renders before the refetch" bugs (see the Array.isArray guards scattered
// through consumers). Cold start now paints skeletons and fetches fresh —
// the same launch behavior as the smooth siblings. Do not re-add persistence
// to fix launch blankness; add/keep per-screen skeletons instead.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";

// One-time hygiene: delete the dead persisted-cache blob left on devices by
// the removed persister (it could be hundreds of KB and would otherwise sit
// in AsyncStorage forever). Safe to keep calling — a no-op once cleared.
void AsyncStorage.removeItem("meridian.query-cache.v1").catch(() => {});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s — same as PWA
      // In-memory retention for inactive queries (detail screens navigated
      // away from, non-current calendar months). Tab screens stay mounted so
      // their queries are always active; 10min covers push-screen roundtrips
      // without hoarding every window ever fetched (the old 24h was sized
      // for the now-removed offline persistence).
      gcTime: 10 * 60 * 1000,
      // One retry for flaky mobile networks — but NEVER retry auth/paywall/
      // client errors: a 401 retry just double-fires the sign-out and delays
      // the redirect; a 402 re-triggers the paywall; other 4xx are deterministic.
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } } | undefined)
          ?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      retryDelay: 500,
      refetchOnReconnect: true,
      // Refetch on mount only when the data is STALE (past staleTime) — a fresh
      // cache paints instantly on a fast tab switch with no spinner flash.
      // (`"always"` refetched on every mount regardless of freshness,
      // amplifying the per-habit fan-out.)
      refetchOnMount: true,
      refetchOnWindowFocus: false, // RN doesn't have window focus; AppState foreground triggers this elsewhere if you want it
    },
    mutations: {
      // Mutations don't retry by default — most are destructive or have
      // user-visible side effects, so retrying without explicit consent
      // is risky. Wire `retry` per-mutation when the call is idempotent.
      retry: 0,
    },
  },
});
