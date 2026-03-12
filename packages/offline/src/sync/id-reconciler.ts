import { db, getTableForEntity } from "../db/index";

export async function reconcileId(
  entityType: string,
  tempId: string,
  serverEntity: Record<string, unknown>,
): Promise<void> {
  const table = getTableForEntity(entityType);

  await db.transaction("rw", table, db.pendingMutations, async () => {
    // Remove temp record and insert server record with real ID
    await table.delete(tempId as any);
    await table.put(serverEntity);

    // Update any pending mutations that reference this temp ID
    const dependents = await db.pendingMutations
      .filter(
        (m) =>
          m.entityId === tempId ||
          m.path.includes(tempId) ||
          JSON.stringify(m.payload).includes(tempId),
      )
      .toArray();

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
