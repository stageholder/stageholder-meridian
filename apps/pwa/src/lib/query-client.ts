import { MutationCache, QueryClient } from "@tanstack/react-query";

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
export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
  mutationCache: new MutationCache({
    // The optimistic contract (`api/optimistic.ts`) cancels in-flight fetches
    // of every cache a write touches, so a stale response can't land on top
    // of the optimistic value. A query that was still on its FIRST fetch has
    // no value to protect — and once cancelled it sits `pending` + `idle`
    // with `data: undefined`, which the views render as "empty", until some
    // unrelated trigger refetches it (the list you open and immediately add
    // a todo to showed "No todos yet" until a reload). After every mutation
    // settles, refetch exactly those data-less, observed queries: nothing was
    // on screen for them, so this can't revert an optimistic change.
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.state.data === undefined &&
          q.state.fetchStatus === "idle" &&
          q.getObserversCount() > 0,
      });
    },
  }),
});
