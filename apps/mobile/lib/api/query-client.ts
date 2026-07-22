// apps/mobile/lib/api/query-client.ts
//
// QueryClient configuration + AsyncStorage-backed cache persistence.
// Persistence gives the app instant-loading screens on relaunch: when
// `bun start` reloads, the cached todos/habits/journal entries paint
// immediately while the live fetch runs in the background.
//
// Defaults mirror the PWA (staleTime: 30s, retry: 1) so dev experience
// is consistent across surfaces.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s — same as PWA
      gcTime: 24 * 60 * 60 * 1000, // 24h kept in cache for offline-friendly relaunches
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
      // cache paints instantly on a fast tab switch with no spinner flash, which
      // is the whole point of the persisted cache. (`"always"` refetched on
      // every mount regardless of freshness, amplifying the per-habit fan-out.)
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

/**
 * Persister for hydrating the React Query cache from AsyncStorage on
 * app launch and writing it back on changes. The version bump should
 * be incremented when query shapes change in a backwards-incompatible
 * way — bumping invalidates the persisted cache so users don't see
 * stale data shaped for an older client.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "meridian.query-cache.v1",
  // PERF: each persist JSON.stringifies the ENTIRE dehydrated cache (24h
  // gcTime — every habit entry window, calendar month, stats…) on the JS
  // thread. At 1s that spike landed mid-scroll during any burst of
  // refetches/mutations. 5s keeps relaunch hydration effectively as fresh
  // (the persister still writes the trailing edge) at a fifth of the cost.
  throttleTime: 5000,
});
