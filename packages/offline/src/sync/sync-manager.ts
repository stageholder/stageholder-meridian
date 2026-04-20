import type { AxiosInstance } from "axios";
import type { EntityTable } from "dexie";
import { db } from "../db/index";
import { flush } from "./mutation-queue";

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

export async function syncEntity<T extends SyncableEntity>(
  entityType: string,
  userSub: string,
  table: EntityTable<T, "id">,
  fetchFn: (since?: string) => Promise<T[]>,
): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = [];

  // Read last sync timestamp for delta sync
  const meta = await db.syncMeta.get([entityType, userSub]);
  const since = meta?.lastSyncedAt;

  const serverData = await fetchFn(since);
  if (!Array.isArray(serverData)) return conflicts;

  await db.transaction(
    "rw",
    table,
    db.syncMeta,
    db.pendingMutations,
    async () => {
      for (const item of serverData) {
        // Handle tombstones: if server says deleted, remove from Dexie
        if (item.deletedAt) {
          await table.delete(item.id as never);
          continue;
        }

        // Check if this entity has pending local mutations (potential conflict)
        const hasPending = await db.pendingMutations
          .where("entityType")
          .equals(entityType)
          .filter((m) => {
            const entityId = m.entityId || m.tempId;
            return entityId === item.id && m.status !== "in-flight";
          })
          .count();

        const local = await table.get({ id: item.id } as never);

        if (!local) {
          await table.put(item);
        } else {
          const localUpdated = (local as SyncableEntity).updatedAt;
          const serverUpdated = item.updatedAt;
          if (serverUpdated && localUpdated && serverUpdated >= localUpdated) {
            if (hasPending > 0) {
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

export async function fullSync(
  userSub: string,
  client: AxiosInstance,
  fetchers: Record<string, (since?: string) => Promise<SyncableEntity[]>>,
  tables: Record<string, EntityTable<SyncableEntity, "id">>,
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
