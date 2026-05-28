// =============================================================================
// Dexie → DataStore adapter
// =============================================================================
//
// Wraps the singleton Dexie `db` (`./index.ts`) to satisfy the cross-platform
// `DataStore` contract (`./interface.ts`). The sync engine + mutation queue
// import the adapter (`dataStore`) instead of Dexie directly, so the engine
// only ever calls operations that the future React Native SQLite
// implementation can also provide.
//
// Why wrap at all (vs. typing `db` as `DataStore`): Dexie's `EntityTable` /
// `Table` aren't structurally compatible with the narrow interface —
// `table.where("field").equals(v)` returns a Dexie `Collection`, not
// `Promise<T[]>`; `db.transaction("rw", table1, table2, cb)` is variadic,
// not array-of-names. The adapter translates these into interface shape.
//
// Web bundle cost: ~0. The adapter is a few hundred bytes of glue and
// imports the same Dexie classes the rest of `@repo/offline` already pulls
// in. On mobile, `db/index.native.ts` (future) ships its own SQLite-backed
// `dataStore` export — Metro picks the suffix, the adapter isn't loaded.
// =============================================================================

import { db as dexieDb, type PendingMutation } from "./index";
import type { DataStore, EntityStore, AutoIncrementStore } from "./interface";

// Each Dexie `EntityTable` / `Table` exposes a superset of what `EntityStore`
// declares; we delegate one-to-one. The `any` here is the adapter boundary —
// inside the adapter we trust Dexie's types, outside we serve the strict
// interface. `where(criteria)` returns a Dexie `Collection` whose `.toArray()`
// runs the query, which matches `EntityStore.where`'s `Promise<T[]>`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapEntityTable<T, K = string>(table: any): EntityStore<T, K> {
  return {
    get: (key) => table.get(key),
    put: (entity) => table.put(entity),
    bulkPut: (entities) => table.bulkPut(entities),
    update: (key, changes) => table.update(key, changes),
    delete: (key) => table.delete(key),
    toArray: () => table.toArray(),
    where: (criteria) => table.where(criteria).toArray(),
    clear: () => table.clear(),
    bulkDelete: (keys) => table.bulkDelete(keys),
  };
}

// Auto-incremented tables use Dexie's `add()` (assigns the id) — the interface
// hides this behind `put()` so callers don't need to remember which flavor of
// store they're talking to.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapAutoIncrementTable<T, Id extends keyof T>(
  table: any,
): AutoIncrementStore<T, Id> {
  return {
    get: (key) => table.get(key),
    put: (entity) => table.add(entity),
    bulkPut: (entities) => table.bulkAdd(entities),
    update: (key, changes) => table.update(key, changes),
    delete: (key) => table.delete(key),
    toArray: () => table.toArray(),
    where: (criteria) => table.where(criteria).toArray(),
    clear: () => table.clear(),
    bulkDelete: (keys) => table.bulkDelete(keys),
  };
}

/**
 * The active `DataStore` for the web bundle — a thin facade over the Dexie
 * singleton. Use this from the sync engine + mutation queue so the call sites
 * stay cross-platform.
 *
 * For Dexie-specific power (compound indexes, `liveQuery`, `Collection.modify`,
 * range queries) keep importing the raw `db` from `./index` directly — those
 * usages are web-only by design and don't belong in the shared engine.
 */
export const dataStore: DataStore = {
  todoLists: wrapEntityTable(dexieDb.todoLists),
  todos: wrapEntityTable(dexieDb.todos),
  journals: wrapEntityTable(dexieDb.journals),
  habits: wrapEntityTable(dexieDb.habits),
  habitEntries: wrapEntityTable(dexieDb.habitEntries),
  tags: wrapEntityTable(dexieDb.tags),
  notifications: wrapEntityTable(dexieDb.notifications),
  pendingMutations: wrapAutoIncrementTable<PendingMutation, "id">(
    dexieDb.pendingMutations,
  ),
  syncMeta: wrapEntityTable(dexieDb.syncMeta),
  entitlementCache: wrapEntityTable(dexieDb.entitlementCache),
  journalSecurityCache: wrapEntityTable(dexieDb.journalSecurityCache),
  transaction: (mode, tables, callback) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dexieDb.transaction(
      mode,
      tables.map(
        (name) => (dexieDb as unknown as Record<string, unknown>)[name],
      ) as never,
      callback,
    ),
};
