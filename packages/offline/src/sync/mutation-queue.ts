import type { AxiosInstance } from "axios";
import { db, type PendingMutation } from "../db/index";
import { reconcileId } from "./id-reconciler";
import { logger } from "@repo/core/platform/logger";

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

export async function enqueue(
  mutation: Omit<PendingMutation, "id" | "retryCount" | "status" | "timestamp">,
): Promise<void> {
  await db.pendingMutations.add({
    ...mutation,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  });
}

export async function flush(
  client: AxiosInstance,
): Promise<{ success: number; failed: number }> {
  const pending = await db.pendingMutations
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("timestamp");

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
  return db.pendingMutations.where("status").anyOf("pending", "failed").count();
}

export async function getFailedMutations(): Promise<PendingMutation[]> {
  return db.pendingMutations.where("status").equals("failed").toArray();
}

export async function dismissMutation(id: number): Promise<void> {
  await db.pendingMutations.delete(id);
}

export async function dismissAllFailed(): Promise<void> {
  const failed = await db.pendingMutations
    .where("status")
    .equals("failed")
    .toArray();
  await db.pendingMutations.bulkDelete(
    failed.map((m) => m.id!).filter(Boolean),
  );
}

export async function clear(): Promise<void> {
  await db.pendingMutations.clear();
}
