import { dataStore as db } from "../db/adapter";
import type { PendingMutation } from "../db/index";
import { reconcileId } from "./id-reconciler";
import { logger } from "@repo/core/platform/logger";

/**
 * Structural shape the mutation queue needs from the host's API client.
 * Compatible with both axios's `AxiosInstance` (mobile, packages/core) and
 * the PWA's `ServiceWrapper` (SDK SPA-backed fetch wrapper).
 *
 * Only the three methods the queue actually calls are required — anything
 * else on the underlying client is irrelevant here.
 */
export interface MutationApiClient {
  post(
    path: string,
    payload?: unknown,
  ): Promise<{ data: { id?: string } & Record<string, unknown> }>;
  patch(path: string, payload?: unknown): Promise<unknown>;
  delete(path: string): Promise<unknown>;
}

const MAX_RETRIES = 5;

type PayloadTransform = (
  payload: unknown,
  operation: string,
) => Promise<unknown>;

const payloadTransforms: Record<string, PayloadTransform> = {};

export function registerPayloadTransform(
  entityType: string,
  transform: PayloadTransform,
): void {
  payloadTransforms[entityType] = transform;
}

/**
 * Queue a mutation for the given user. Every mutation is scoped by
 * `userSub` so a sign-out + sign-in as a different account never replays
 * the previous user's writes.
 *
 * `pendingMutations` is auto-incremented; the `AutoIncrementStore.put`
 * adapter unifies Dexie's `.add()` and a SQLite INSERT under one method.
 */
export async function enqueue(
  userSub: string,
  mutation: Omit<
    PendingMutation,
    "id" | "userSub" | "retryCount" | "status" | "timestamp"
  >,
): Promise<void> {
  await db.pendingMutations.put({
    ...mutation,
    userSub,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  });
}

/**
 * Return the pending-status mutations for the current user. Used by the
 * sync manager to know what to replay against the API.
 */
export async function listPending(userSub: string): Promise<PendingMutation[]> {
  return db.pendingMutations.where({ userSub, status: "pending" });
}

/**
 * Delete mutations that belong to any user other than `currentSub`.
 * Called on login when the active user changes so stale writes from a
 * previously signed-in account don't accidentally get flushed.
 *
 * The narrow `EntityStore.where` does equality only — no Dexie `notEqual`.
 * Load all, filter inverse, bulk-delete. The queue per user is small
 * (typically <100 rows), so the round-trip is negligible.
 */
export async function clearForOtherSubs(currentSub: string): Promise<number> {
  const all = await db.pendingMutations.toArray();
  const toDelete = all.filter((m) => m.userSub !== currentSub);
  if (toDelete.length === 0) return 0;
  const ids = toDelete
    .map((m) => m.id)
    .filter((id): id is number => id !== undefined);
  await db.pendingMutations.bulkDelete(ids);
  return toDelete.length;
}

/**
 * Load the union of pending + failed mutations, sorted by timestamp.
 * Replaces Dexie's `.where("status").anyOf("pending", "failed").sortBy(...)`
 * with two `where({status})` queries + JS sort — same result, expressible
 * against the narrow interface.
 */
async function loadFlushable(): Promise<PendingMutation[]> {
  const [pending, failed] = await Promise.all([
    db.pendingMutations.where({ status: "pending" }),
    db.pendingMutations.where({ status: "failed" }),
  ]);
  return [...pending, ...failed].sort((a, b) => a.timestamp - b.timestamp);
}

export async function flush(
  client: MutationApiClient,
  userSub?: string,
): Promise<{ success: number; failed: number }> {
  const flushable = await loadFlushable();
  const pending = userSub
    ? flushable.filter((m) => m.userSub === userSub)
    : flushable;

  let success = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (mutation.retryCount >= MAX_RETRIES) continue;

    try {
      await db.pendingMutations.update(mutation.id!, { status: "in-flight" });

      let payload = mutation.payload;
      const transform = payloadTransforms[mutation.entityType];
      if (transform) {
        payload = await transform(payload, mutation.operation);
      }

      switch (mutation.operation) {
        case "create": {
          const res = await client.post(mutation.path, payload);
          if (
            mutation.tempId &&
            res.data?.id &&
            mutation.tempId !== res.data.id
          ) {
            await reconcileId(mutation.entityType, mutation.tempId, res.data);
          }
          break;
        }
        case "update":
          await client.patch(mutation.path, payload);
          break;
        case "delete":
          await client.delete(mutation.path);
          break;
      }

      await db.pendingMutations.delete(mutation.id!);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[MutationQueue] ${mutation.operation} ${mutation.path} failed (attempt ${mutation.retryCount + 1}/${MAX_RETRIES}): ${message}`,
      );
      await db.pendingMutations.update(mutation.id!, {
        status: "failed",
        retryCount: mutation.retryCount + 1,
      });
      failed++;
    }
  }

  return { success, failed };
}

export async function getPendingCount(): Promise<number> {
  const flushable = await loadFlushable();
  return flushable.length;
}

export async function getFailedMutations(): Promise<PendingMutation[]> {
  return db.pendingMutations.where({ status: "failed" });
}

export async function dismissMutation(id: number): Promise<void> {
  await db.pendingMutations.delete(id);
}

export async function dismissAllFailed(): Promise<void> {
  const failed = await db.pendingMutations.where({ status: "failed" });
  const ids = failed
    .map((m) => m.id)
    .filter((id): id is number => id !== undefined);
  await db.pendingMutations.bulkDelete(ids);
}

export async function clear(): Promise<void> {
  await db.pendingMutations.clear();
}
