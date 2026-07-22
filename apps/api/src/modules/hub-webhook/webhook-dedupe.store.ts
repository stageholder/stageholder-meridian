import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { WebhookDedupeStore } from "@stageholder/sdk/nestjs";
import {
  WebhookDedupeMark,
  WebhookDedupeMarkDocument,
} from "./webhook-store.schema";

/**
 * Mongo-backed idempotency store for the SDK `WebhookDispatcher`. Durable and
 * shared across API replicas, unlike the SDK's in-memory default — so a Svix
 * redelivery of an already-processed event is skipped no matter which instance
 * receives it.
 *
 * Bound via `StageholderWebhookModule.forRootAsync({ dedupe: { useClass } })`
 * in app.module.ts.
 */
@Injectable()
export class MongoWebhookDedupeStore implements WebhookDedupeStore {
  constructor(
    @InjectModel(WebhookDedupeMark.name)
    private readonly model: Model<WebhookDedupeMarkDocument>,
  ) {}

  async has(eventId: string): Promise<boolean> {
    const exists = await this.model.exists({ _id: eventId });
    return exists != null;
  }

  async remember(eventId: string): Promise<void> {
    // Upsert so concurrent retries of the same id converge on one row rather
    // than racing to insert a duplicate `_id` (which would throw). `_id` comes
    // from the filter on insert — keeping it out of `$setOnInsert` avoids the
    // immutable-`_id` guard some MongoDB versions raise.
    await this.model.updateOne(
      { _id: eventId },
      { $setOnInsert: { seenAt: new Date() } },
      { upsert: true },
    );
  }
}
