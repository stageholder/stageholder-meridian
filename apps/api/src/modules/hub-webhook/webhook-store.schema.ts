import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { DeliveryStatus, DeliverySource } from "@stageholder/sdk/core";

export type WebhookDeliveryLogDocument = HydratedDocument<WebhookDeliveryLog>;

/**
 * Durable log of every inbound Hub webhook delivery attempt — the backing
 * store for the SDK's `WebhookDeliveryStore` (operator-console delivery
 * inspector + replay).
 *
 * Replaces the old failure-only `hub_webhook_failed` DLQ: this records
 * processed / duplicate / failed alike, one row per attempt, so a push that
 * failed followed by a successful replay are both visible in history. The row
 * `_id` is a generated ObjectId (per-attempt), NOT the event id — a single
 * event can have several delivery rows. `payload` holds `event.data` in full
 * so a delivery can be re-dispatched.
 */
@Schema({ collection: "webhook_deliveries", timestamps: true })
export class WebhookDeliveryLog {
  @Prop({ type: String, required: true, index: true })
  eventId: string;

  @Prop({ type: String, required: true, index: true })
  eventType: string;

  @Prop({ type: String, required: true, index: true })
  status: DeliveryStatus;

  @Prop({ type: String, required: true })
  source: DeliverySource;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ type: Number, required: true })
  durationMs: number;

  @Prop({ type: String, default: null })
  eventTimestamp: string | null;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;
}

export const WebhookDeliveryLogSchema =
  SchemaFactory.createForClass(WebhookDeliveryLog);

export type WebhookDedupeMarkDocument = HydratedDocument<WebhookDedupeMark>;

/**
 * Idempotency marker — one row per successfully-processed Hub event id. Backs
 * the SDK's `WebhookDedupeStore` so Svix redeliveries are skipped ACROSS API
 * replicas (the SDK's in-memory default is per-process only and evicts under
 * load). A TTL index expires marks 30 days after they're written — comfortably
 * longer than Svix's retry window, and keeps the collection bounded.
 *
 * `_id` is the Hub event id itself, so a concurrent retry upserts into the
 * same row rather than duplicating.
 */
@Schema({ collection: "webhook_dedupe" })
export class WebhookDedupeMark {
  @Prop({ type: String, required: true })
  _id: string; // = StageholderWebhookEvent.id

  @Prop({ type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 30 })
  seenAt: Date;
}

export const WebhookDedupeMarkSchema =
  SchemaFactory.createForClass(WebhookDedupeMark);
