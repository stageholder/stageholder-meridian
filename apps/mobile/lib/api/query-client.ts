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
      retry: 1, // mobile networks flap; one retry is the right pragmatic default
      retryDelay: 500,
      refetchOnReconnect: true,
      // Don't refetch on mount if data is still fresh — avoids spinner
      // flashes during fast tab switches.
      refetchOnMount: "always",
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
  throttleTime: 1000, // batch writes to once per second
});
