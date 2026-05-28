import { dataStore as db } from "../db/adapter";
import type { DataStore, EntityStore } from "../db/interface";
import { flush, type MutationApiClient } from "./mutation-queue";

interface SyncableEntity {
  id: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface SyncConflict {
  entityType: string;
  entityId: string;
}

let syncing = false;

/**
 * Pull-side delta sync for one entity type. Reads everything updated on the
 * server since `lastSyncedAt`, reconciles against local rows, and detects
 * cases where the server overwrites a pending local mutation (conflict).
 *
 * Targets the narrow `DataStore` / `EntityStore` interface so the same
 * function works on the PWA's Dexie adapter and a future React Native
 * SQLite implementation — the Dexie chainables (`where(...).equals(...)`
 * `.filter(...).count()` etc.) were replaced with load-then-filter on
 * tables small enough (<200 rows typical) that the extra IO is negligible.
 */
export async function syncEntity<T extends SyncableEntity>(
  entityType: string,
  userSub: string,
  table: EntityStore<T>,
  fetchFn: (since?: string) => Promise<T[]>,
): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = [];

  // Read last sync timestamp for delta sync.
  const meta = await db.syncMeta.get([entityType, userSub]);
  const since = meta?.lastSyncedAt;

  const serverData = await fetchFn(since);
  if (!Array.isArray(serverData)) return conflicts;

  await db.transaction(
    "rw",
    [entityType as keyof DataStore, "syncMeta", "pendingMutations"],
    async () => {
      // Snapshot pending mutations for THIS entity type once per sync pass.
      // We compare each server row against the snapshot — same result as the
      // previous per-row Dexie `.where(...).equals(...).filter(...).count()`,
      // just expressible against the narrow cross-platform interface.
      const pendingForType = await db.pendingMutations.where({ entityType });

      for (const item of serverData) {
        // Tombstones: server says deleted → remove locally.
        if (item.deletedAt) {
          await table.delete(item.id);
          continue;
        }

        const hasPending =
          pendingForType.filter((m) => {
            const entityId = m.entityId || m.tempId;
            return entityId === item.id && m.status !== "in-flight";
          }).length > 0;

        const local = await table.get(item.id);

        if (!local) {
          await table.put(item);
        } else {
          const localUpdated = (local as SyncableEntity).updatedAt;
          const serverUpdated = item.updatedAt;
          if (serverUpdated && localUpdated && serverUpdated >= localUpdated) {
            if (hasPending) {
              conflicts.push({ entityType, entityId: item.id });
            }
            await table.put(item);
          }
        }
      }

      await db.syncMeta.put({
        entityType,
        userSub,
        lastSyncedAt: new Date().toISOString(),
      });
    },
  );

  return conflicts;
}

/**
 * Flush pending writes, then delta-sync every registered entity type.
 * `tables` is a name → `EntityStore` map provided by the host app (web
 * passes the Dexie adapter's stores; mobile will pass its SQLite stores).
 */
export async function fullSync(
  userSub: string,
  client: MutationApiClient,
  fetchers: Record<string, (since?: string) => Promise<SyncableEntity[]>>,
  tables: Record<string, EntityStore<SyncableEntity>>,
): Promise<SyncConflict[]> {
  if (syncing) return [];
  syncing = true;

  const allConflicts: SyncConflict[] = [];

  try {
    await flush(client, userSub);

    for (const [entityType, fetchFn] of Object.entries(fetchers)) {
      const table = tables[entityType];
      if (table) {
        const conflicts = await syncEntity(entityType, userSub, table, fetchFn);
        allConflicts.push(...conflicts);
      }
    }
  } finally {
    syncing = false;
  }

  return allConflicts;
}

export function isSyncing(): boolean {
  return syncing;
}
