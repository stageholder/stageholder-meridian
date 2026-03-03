import type { AxiosInstance } from 'axios';
import type { EntityTable } from 'dexie';
import { db } from '../db/index';
import { flush } from './mutation-queue';

interface SyncableEntity {
  id: string;
  updatedAt?: string;
}

let syncing = false;

export async function syncEntity<T extends SyncableEntity>(
  entityType: string,
  workspaceId: string,
  table: EntityTable<T, 'id'>,
  fetchFn: () => Promise<T[]>,
): Promise<void> {
  const serverData = await fetchFn();

  await db.transaction('rw', table, db.syncMeta, async () => {
    for (const item of serverData) {
      const local = await table.get({ id: item.id } as never);

      if (!local) {
        await table.put(item);
      } else {
        const localUpdated = (local as SyncableEntity).updatedAt;
        const serverUpdated = item.updatedAt;
        if (serverUpdated && localUpdated && serverUpdated >= localUpdated) {
          await table.put(item);
        }
      }
    }

    await db.syncMeta.put({
      entityType,
      workspaceId,
      lastSyncedAt: new Date().toISOString(),
    });
  });
}

export async function fullSync(
  workspaceId: string,
  client: AxiosInstance,
  fetchers: Record<string, () => Promise<SyncableEntity[]>>,
  tables: Record<string, EntityTable<SyncableEntity, 'id'>>,
): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    await flush(client);

    for (const [entityType, fetchFn] of Object.entries(fetchers)) {
      const table = tables[entityType];
      if (table) {
        await syncEntity(entityType, workspaceId, table, fetchFn);
      }
    }
  } finally {
    syncing = false;
  }
}

export function isSyncing(): boolean {
  return syncing;
}
