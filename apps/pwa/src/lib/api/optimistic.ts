// Shared optimistic-mutation primitives for the react-query data layer.
//
// WHY THIS EXISTS — the reactivity contract for the whole app
// ----------------------------------------------------------------
// Every high-frequency write (check a habit, toggle a todo, change a date,
// reorder a list) must feel INSTANT in production, where each network
// round-trip is 200–800 ms. The industry-standard TanStack pattern that gets
// us there — and the one these helpers encode so each hook is a few lines:
//
//   onMutate:  cancel in-flight fetches → snapshot every affected cache →
//              write the optimistic value into all of them → return the
//              snapshot for rollback.
//   onError:   restore the snapshot verbatim.
//   onSuccess: write the SERVER's authoritative entity into the same caches
//              (`writeEntityToLists`). This is what lets us NOT re-fetch the
//              key we just changed.
//   onSettled: invalidate ONLY aggregate/derived keys we can't compute
//              locally (light totals, stats, calendar) — never the "home"
//              list/detail key the UI reads the changed value from.
//
// The bug this fixes: the old hooks optimistically patched a key and then, in
// onSettled, `invalidateQueries` that SAME key — forcing a refetch that under
// latency returns read-before-write data and visibly reverts the optimistic
// change, so users click again. Writing the server response into the cache and
// only invalidating aggregates removes both the refetch storm and the revert.
import type { QueryClient } from "@tanstack/react-query";

/** A verbatim snapshot of every cache matching a set of key prefixes. */
export type CacheSnapshot = Array<[readonly unknown[], unknown]>;

type Key = readonly unknown[];

/**
 * Cancel any in-flight fetches for the given key prefixes (so a refetch can't
 * land on top of our optimistic write) and snapshot every matching cache entry
 * — across ALL param variants of each key — so `rollback` can restore them
 * exactly if the mutation fails.
 */
export async function snapshotAndCancel(
  qc: QueryClient,
  keys: readonly Key[],
): Promise<CacheSnapshot> {
  await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
  const snap: CacheSnapshot = [];
  for (const k of keys) snap.push(...qc.getQueriesData({ queryKey: k }));
  return snap;
}

/** Restore a snapshot captured by `snapshotAndCancel` (the onError path). */
export function rollback(qc: QueryClient, snap: CacheSnapshot | undefined) {
  if (!snap) return;
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

/**
 * Apply `fn` to every cached ARRAY matching each key prefix (all param
 * variants). Non-array cache entries are skipped. The workhorse for optimistic
 * list edits (insert / remove / patch-in-place / reorder).
 */
export function patchLists<T>(
  qc: QueryClient,
  keys: readonly Key[],
  fn: (list: T[]) => T[],
): void {
  for (const k of keys) {
    for (const [key, data] of qc.getQueriesData<T[]>({ queryKey: k })) {
      if (!Array.isArray(data)) continue;
      qc.setQueryData<T[]>(key, fn(data));
    }
  }
}

/**
 * Patch a single item (matched by id) in every cached list, merging `changes`.
 * Lists that don't contain the id are returned untouched (no needless
 * re-render / new identity).
 */
export function patchItemInLists<T extends { id: string }>(
  qc: QueryClient,
  keys: readonly Key[],
  id: string,
  changes: Partial<T>,
): void {
  patchLists<T>(qc, keys, (list) => {
    if (!list.some((i) => i.id === id)) return list;
    return list.map((i) => (i.id === id ? { ...i, ...changes } : i));
  });
}

/**
 * Write an AUTHORITATIVE server entity into every cached list that already
 * holds an item with `matchId` (defaults to the entity's own id — pass a temp
 * id to swap an optimistic placeholder for the real record). Lists without the
 * id are left untouched. Call this from onSuccess so the home key never needs a
 * refetch.
 */
export function writeEntityToLists<T extends { id: string }>(
  qc: QueryClient,
  keys: readonly Key[],
  entity: T,
  matchId: string = entity.id,
): void {
  patchLists<T>(qc, keys, (list) => {
    if (!list.some((i) => i.id === matchId)) return list;
    return list.map((i) => (i.id === matchId ? entity : i));
  });
}

/** Remove an item (by id) from every cached list. */
export function removeFromLists<T extends { id: string }>(
  qc: QueryClient,
  keys: readonly Key[],
  id: string,
): void {
  patchLists<T>(qc, keys, (list) => list.filter((i) => i.id !== id));
}

/**
 * Invalidate a set of AGGREGATE keys (light, stats, calendar) — the derived
 * surfaces we can't cheaply recompute client-side. Fire-and-forget. NEVER pass
 * the home list/detail key here: that's the one we write authoritatively from
 * the server response instead of re-fetching.
 */
export function invalidateAggregates(
  qc: QueryClient,
  keys: readonly Key[],
): void {
  for (const k of keys) void qc.invalidateQueries({ queryKey: k });
}

/**
 * A stable per-entity mutation scope. Passing `scope` to `useMutation`
 * SERIALIZES mutations that share the same scope id (TanStack runs them one at
 * a time instead of in parallel), so rapid repeat taps on the same row can't
 * race into duplicate creates / stale-id updates — without ever disabling the
 * control. Pair with optimistic updates so the UI still feels instant.
 */
export function entityScope(...parts: (string | number)[]) {
  return { id: parts.join(":") };
}
