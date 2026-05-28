import { dataStore as db } from "../db/adapter";
import type { DataStore, EntityStore } from "../db/interface";

/**
 * Maps `entityType` strings (as written into `pendingMutations.entityType`
 * + sync fetchers) to their `DataStore` table names. Mirrors the
 * `getTableForEntity` helper in `../db/index.ts` but typed against the
 * cross-platform interface so id reconciliation stays portable to the
 * future React Native SQLite implementation.
 */
const ENTITY_STORE_NAMES = {
  habits: "habits",
  habitEntries: "habitEntries",
  todos: "todos",
  todoLists: "todoLists",
  journals: "journals",
  tags: "tags",
  notifications: "notifications",
} as const satisfies Record<string, keyof DataStore>;

function resolveStore(entityType: string): {
  name: keyof DataStore;
  store: EntityStore<{ id: string }>;
} {
  const name = (ENTITY_STORE_NAMES as Record<string, keyof DataStore>)[
    entityType
  ];
  if (!name) throw new Error(`Unknown entity type: ${entityType}`);
  const store = (db as unknown as Record<string, EntityStore<{ id: string }>>)[
    name
  ];
  return { name, store };
}

/**
 * After a queued `create` flushes, the server returns a real id and we need
 * to (a) replace the optimistic temp row with the server row and (b) rewrite
 * any *other* pending mutations that referenced the tempId. Runs inside a
 * transaction so the swap is atomic — partial-state crashes can't leave a
 * tempId that's been deleted but not yet rewritten in the queue.
 *
 * Targets the narrow `DataStore` so the same logic runs against Dexie on
 * web and a future SQLite-backed store on mobile.
 */
export async function reconcileId(
  entityType: string,
  tempId: string,
  serverEntity: Record<string, unknown>,
): Promise<void> {
  const { name: storeName, store } = resolveStore(entityType);

  await db.transaction("rw", [storeName, "pendingMutations"], async () => {
    // Remove the temp record and insert the server record with the real id.
    await store.delete(tempId);
    await store.put(serverEntity as { id: string });

    // Update any pending mutations that reference this tempId. The narrow
    // `EntityStore` interface has no predicate-form `.filter()`, so we load
    // + filter in JS — pendingMutations is small (typically <200 rows), so
    // the extra IO is negligible.
    const all = await db.pendingMutations.toArray();
    const dependents = all.filter(
      (m) =>
        m.entityId === tempId ||
        m.path.includes(tempId) ||
        JSON.stringify(m.payload).includes(tempId),
    );

    for (const dep of dependents) {
      const serverId = String(serverEntity.id);
      await db.pendingMutations.update(dep.id!, {
        path: dep.path.replaceAll(tempId, serverId),
        payload: JSON.parse(
          JSON.stringify(dep.payload).replaceAll(tempId, serverId),
        ),
        entityId: dep.entityId === tempId ? serverId : dep.entityId,
      });
    }
  });
}
