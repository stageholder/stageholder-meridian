import { QueryClient } from "@tanstack/react-query";

/**
 * The app's single QueryClient instance.
 *
 * It lives at module scope (not inside a component's `useState`) so that code
 * OUTSIDE the React tree can reach the same cache the UI is reading — most
 * importantly `encryption-store.ts`'s `lock()`, which must synchronously evict
 * decrypted journal plaintext from the cache when the session is locked.
 * Sharing one instance here is what makes that eviction actually land on the
 * live client `<QueryClientProvider>` is rendering (a previous `getQueryClient()`
 * indirection always returned null because its provider was never mounted).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
