import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type {
  WebhookDeliveryStore,
  WebhookDeliveryRecord,
} from "@stageholder/sdk/nestjs";
import type {
  WebhookDelivery,
  DeliveryStatus,
  DeliverySource,
} from "@stageholder/sdk/core";
import {
  WebhookDeliveryLog,
  WebhookDeliveryLogDocument,
} from "./webhook-store.schema";

/** Lean shape read back from Mongo (class fields + timestamps + _id). */
type LeanDelivery = {
  _id: unknown;
  eventId: string;
  eventType: string;
  status: DeliveryStatus;
  source: DeliverySource;
  error: string | null;
  durationMs: number;
  eventTimestamp: string | null;
  payload: Record<string, unknown>;
  createdAt?: Date;
};

function toWebhookDelivery(doc: LeanDelivery): WebhookDelivery {
  return {
    id: String(doc._id),
    eventId: doc.eventId,
    eventType: doc.eventType,
    status: doc.status,
    source: doc.source,
    error: doc.error ?? null,
    durationMs: doc.durationMs,
    eventTimestamp: doc.eventTimestamp ?? null,
    payload: doc.payload ?? {},
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

/**
 * Mongo-backed implementation of the SDK's `WebhookDeliveryStore` — a durable
 * log of every inbound Hub webhook delivery. Powers the operator console's
 * delivery inspector + replay (once `StageholderOperatorModule` is mounted).
 *
 * Replaces Meridian's old hand-rolled `HubWebhookFailed` DLQ + `recordFailure`
 * / `retryFailed` plumbing: the SDK dispatcher now records deliveries through
 * this store, and replay flows through the operator console's
 * `dispatchAndRecord(event, "replay")` path.
 *
 * Bound via `StageholderWebhookModule.forRootAsync({ deliveryStore: { useClass } })`.
 */
@Injectable()
export class MongoWebhookDeliveryStore implements WebhookDeliveryStore {
  private readonly logger = new Logger(MongoWebhookDeliveryStore.name);

  constructor(
    @InjectModel(WebhookDeliveryLog.name)
    private readonly model: Model<WebhookDeliveryLogDocument>,
  ) {}

  /**
   * FIRE-AND-FORGET: MUST NOT throw into the webhook path. The dispatcher only
   * traps SYNCHRONOUS throws, so the async persistence failure is swallowed +
   * logged here rather than returned as a rejecting promise — a failed audit
   * write can't be allowed to turn a handled event into a 500 that Svix
   * redelivers.
   */
  record(input: WebhookDeliveryRecord): void {
    this.model
      .create({
        eventId: input.event.id,
        eventType: input.event.type,
        status: input.status,
        source: input.source,
        error: input.error ?? null,
        durationMs: input.durationMs,
        eventTimestamp: input.event.timestamp ?? null,
        payload: (input.event.data ?? {}) as Record<string, unknown>,
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to record webhook delivery (${input.event.type}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }

  async list(opts: {
    status?: string;
    type?: string;
    limit: number;
    skip: number;
  }): Promise<{ rows: WebhookDelivery[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (opts.status) filter.status = opts.status;
    if (opts.type) filter.eventType = opts.type;

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .lean<LeanDelivery[]>(),
      this.model.countDocuments(filter),
    ]);

    return { rows: docs.map(toWebhookDelivery), total };
  }

  async getById(id: string): Promise<WebhookDelivery | null> {
    const doc = await this.model.findById(id).lean<LeanDelivery>();
    return doc ? toWebhookDelivery(doc) : null;
  }

  async statusCounts(): Promise<Record<string, number>> {
    const rows = await this.model.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {
      processed: 0,
      duplicate: 0,
      failed: 0,
    };
    for (const r of rows) counts[r._id] = r.n;
    return counts;
  }

  async deleteMany(ids: string[]): Promise<number> {
    const res = await this.model.deleteMany({ _id: { $in: ids } });
    return res.deletedCount ?? 0;
  }
}
