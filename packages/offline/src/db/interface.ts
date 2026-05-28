// =============================================================================
// DataStore — cross-platform offline storage contract
// =============================================================================
//
// The current `db` singleton (./index.ts) is a `Dexie` subclass — IndexedDB-
// backed, web-only. This file defines the storage CONTRACT the rest of
// `@repo/offline` (sync-manager, mutation-queue, hooks) should target so a
// future React Native mobile app can ship a SQLite-backed implementation
// without forking the sync logic.
//
// Two-app strategy:
//
//   apps/pwa (web)        →  Dexie (IndexedDB) impl in ./index.ts
//   apps/mobile (RN)      →  SQLite impl in a future ./index.native.ts
//                            (Metro resolves the .native suffix), exposing
//                            the same `db: DataStore` named export.
//
// Both implementations satisfy `DataStore`. Consumers that need to work on
// both platforms import the TYPE from here and use the `db` symbol:
//
//   import { db } from "@repo/offline/db";
//   import type { DataStore } from "@repo/offline/db/interface";
//   const dataStore: DataStore = db;  // contract-typed access
//
// The current Dexie `db` satisfies this interface structurally (each Dexie
// `EntityTable` provides `get`/`put`/`where`/`toArray`/`update`/`delete`/
// `clear`). No code change at consumers is required to start typing against
// the interface — it's purely additive.
//
// =============================================================================
// Migration path (when the mobile app begins)
// =============================================================================
//
// 1. Refactor `sync-manager.fullSync()` and `mutation-queue.flush()` to take
//    their `db` via a parameter (DI) instead of importing the singleton.
//    Web call site (apps/pwa/src/lib/offline.ts) starts passing `{ db }`.
// 2. The mobile app implements `DataStore` over `expo-sqlite` (or
//    `op-sqlite` / WatermelonDB) and passes its own `db`. The sync engine
//    works unchanged.
// 3. Apps' direct `db.X.put(…)` queries (in `lib/api/*`, `lib/crypto/*`,
//    `lib/entitlement.ts`) stay per-app — those are wiring, not engine
//    logic. The mobile app writes its own `lib/api/*` against its own `db`.
//
// What's INTENTIONALLY narrow here: this interface only models what the
// SYNC ENGINE needs to be portable. Apps using Dexie-specific features
// (`Collection.modify`, compound indexes, `liveQuery`) can keep typing
// against `import { db } from "@repo/offline/db"` and stay platform-
// specific — that's fine. The contract is for the shared engine.
//
// =============================================================================

import type {
  TodoList,
  Todo,
  Journal,
  Habit,
  HabitEntry,
  Tag,
  AppNotification,
} from "@repo/core/types";
import type {
  PendingMutation,
  SyncMeta,
  EntitlementCache,
  JournalSecurityCache,
} from "./index.js";

/**
 * Per-entity store. Mirrors the minimal Dexie `EntityTable` /`Table` surface
 * the sync engine + mutation queue use. Designed to be implementable over
 * IndexedDB (Dexie), SQLite (`expo-sqlite`, `op-sqlite`), or any other
 * key-value/document store.
 *
 * Type params:
 *   T — the row type (e.g. `Habit`).
 *   K — the primary key type (usually `string`, sometimes a tuple for
 *       compound keys — e.g. `[string, string]` for syncMeta's
 *       `[entityType+userSub]`).
 */
export interface EntityStore<T, K = string> {
  /** Get a single row by primary key. Returns `undefined` when missing. */
  get(key: K): Promise<T | undefined>;
  /**
   * Upsert a row by primary key. Returns the key (Dexie returns the inserted
   * id; SQLite impls can return the same key).
   */
  put(entity: T): Promise<K>;
  /** Upsert many rows in a single round-trip. */
  bulkPut(entities: T[]): Promise<K>;
  /** Patch fields on an existing row. Returns count of rows updated. */
  update(key: K, changes: Partial<T>): Promise<number>;
  /** Delete a single row by primary key. */
  delete(key: K): Promise<void>;
  /** Read all rows in the table. */
  toArray(): Promise<T[]>;
  /**
   * Equality filter on one or more fields. Implementations are free to use
   * indexes where available. For chainable Dexie queries (compound indexes,
   * range queries) callers should keep using the Dexie API directly via
   * `import { db } from "@repo/offline/db"` — this interface is intentionally
   * narrow to what the sync engine needs.
   */
  where(criteria: Partial<T>): Promise<T[]>;
  /** Remove every row in the table. Used on logout / account-switch wipes. */
  clear(): Promise<void>;
}

/**
 * For tables whose primary key is auto-incremented (`pendingMutations.id`).
 * `put` accepts a row WITHOUT the key and the impl assigns one. Mirrors
 * Dexie's `EntityTable<T, "id">` behavior with `++id`.
 */
export interface AutoIncrementStore<T, Id extends keyof T> extends Omit<
  EntityStore<T, T[Id]>,
  "put" | "bulkPut"
> {
  put(entity: Omit<T, Id> & Partial<Pick<T, Id>>): Promise<T[Id]>;
  bulkPut(entities: Array<Omit<T, Id> & Partial<Pick<T, Id>>>): Promise<T[Id]>;
}

/**
 * Top-level storage contract. The set of tables matches what `MeridianDB`
 * declares today (`./index.ts`). When schema evolves, update BOTH the Dexie
 * `version().stores({…})` block AND this interface so the contract stays
 * truthful.
 */
export interface DataStore {
  // ─── App data tables ────────────────────────────────────────────────────
  todoLists: EntityStore<TodoList>;
  todos: EntityStore<Todo>;
  journals: EntityStore<Journal>;
  habits: EntityStore<Habit>;
  habitEntries: EntityStore<HabitEntry>;
  tags: EntityStore<Tag>;
  notifications: EntityStore<AppNotification>;
  // ─── Sync infrastructure tables ─────────────────────────────────────────
  pendingMutations: AutoIncrementStore<PendingMutation, "id">;
  syncMeta: EntityStore<SyncMeta, [string, string]>;
  entitlementCache: EntityStore<EntitlementCache, string>;
  journalSecurityCache: EntityStore<JournalSecurityCache, string>;

  /**
   * Run an atomic transaction across the named tables. The callback runs
   * inside the transaction; throwing rolls back. SQLite-native; Dexie wraps
   * this on web. The `mode` matches Dexie's `"r" | "rw"` convention.
   */
  transaction<R>(
    mode: "r" | "rw",
    tables: Array<keyof DataStore>,
    callback: () => Promise<R>,
  ): Promise<R>;
}
