import type { AxiosInstance } from 'axios';
import { db, type PendingMutation } from '../db/index';

const MAX_RETRIES = 5;

export async function enqueue(
  mutation: Omit<PendingMutation, 'id' | 'retryCount' | 'status' | 'timestamp'>,
): Promise<void> {
  await db.pendingMutations.add({
    ...mutation,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  });
}

export async function flush(
  client: AxiosInstance,
): Promise<{ success: number; failed: number }> {
  const pending = await db.pendingMutations
    .where('status')
    .anyOf('pending', 'failed')
    .sortBy('timestamp');

  let success = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (mutation.retryCount >= MAX_RETRIES) continue;

    try {
      await db.pendingMutations.update(mutation.id!, { status: 'in-flight' });

      switch (mutation.operation) {
        case 'create':
          await client.post(mutation.path, mutation.payload);
          break;
        case 'update':
          await client.patch(mutation.path, mutation.payload);
          break;
        case 'delete':
          await client.delete(mutation.path);
          break;
      }

      await db.pendingMutations.delete(mutation.id!);
      success++;
    } catch {
      await db.pendingMutations.update(mutation.id!, {
        status: 'failed',
        retryCount: mutation.retryCount + 1,
      });
      failed++;
    }
  }

  return { success, failed };
}

export async function getPendingCount(): Promise<number> {
  return db.pendingMutations.where('status').anyOf('pending', 'failed').count();
}

export async function clear(): Promise<void> {
  await db.pendingMutations.clear();
}
