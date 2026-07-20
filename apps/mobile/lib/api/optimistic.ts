// Shared optimistic-mutation primitives for the mobile react-query data layer.
// Mirror of the PWA's apps/pwa/src/lib/api/optimistic.ts — same reactivity
// contract so both platforms behave identically.
//
// The contract every write follows:
//   onMutate:  cancel in-flight fetches → snapshot every affected cache →
//              write the optimistic value → return the snapshot for rollback.
//   onError:   restore the snapshot verbatim.
//   onSuccess: write the SERVER's authoritative entity into the caches
//              (`writeEntityToLists`) — so we never re-fetch the key we changed.
//   onSettled: invalidate ONLY aggregate keys we can't compute locally
//              (calendar, light). Never the list/detail key the UI reads the
//              changed value from — re-fetching it under latency returns
//              read-before-write data and reverts the optimistic change.
import type { QueryClient } from "@tanstack/react-query";

export type CacheSnapshot = Array<[readonly unknown[], unknown]>;
type Key = readonly unknown[];

export async function snapshotAndCancel(
  qc: QueryClient,
  keys: readonly Key[],
): Promise<CacheSnapshot> {
  await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
  const snap: CacheSnapshot = [];
  for (const k of keys) snap.push(...qc.getQueriesData({ queryKey: k }));
  return snap;
}

export function rollback(qc: QueryClient, snap: CacheSnapshot | undefined) {
  if (!snap) return;
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

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

export function removeFromLists<T extends { id: string }>(
  qc: QueryClient,
  keys: readonly Key[],
  id: string,
): void {
  patchLists<T>(qc, keys, (list) => list.filter((i) => i.id !== id));
}

export function invalidateAggregates(
  qc: QueryClient,
  keys: readonly Key[],
): void {
  for (const k of keys) void qc.invalidateQueries({ queryKey: k });
}

/**
 * A stable per-entity mutation scope. Passing `scope` to `useMutation`
 * SERIALIZES mutations that share the id so rapid repeat taps can't race into
 * duplicate creates / stale-id updates — without disabling the control.
 */
export const ENTRY_SCOPE = { id: "habit-entry" };
