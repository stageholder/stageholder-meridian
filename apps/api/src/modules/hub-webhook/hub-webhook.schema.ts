import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HubWebhookFailedDocument = HydratedDocument<HubWebhookFailed>;

/**
 * Dead-letter collection for webhook events whose handler threw.
 *
 * The Hub side already retries undelivered events (Svix retry queue) and
 * Hub's own DLQ catches dispatch failures. This collection is for the
 * orthogonal failure mode: Hub delivered the event successfully (HTTP 200
 * back to Svix), but our local handler threw — typically a transient Mongo
 * error or an unexpected payload shape.
 *
 * On 500 from a handler, Hub will retry per Svix's backoff schedule. We
 * write a row here too so operators have a queryable trace and a manual
 * replay path that doesn't depend on Hub's DLQ admin UI.
 *
 * `_id` is the Hub event id (idempotency key from the envelope), so
 * concurrent retries upsert into the same row instead of duplicating.
 */
@Schema({ collection: "hub_webhook_failed", timestamps: true })
export class HubWebhookFailed {
  @Prop({ type: String, required: true })
  _id: string; // = StageholderWebhookEvent.id

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: String, default: null })
  userSub: string | null;

  @Prop({ type: String, required: true })
  occurredAt: string;

  @Prop({ type: Number, required: true, default: 1 })
  attempts: number;

  @Prop({ type: String, required: true })
  lastError: string;

  @Prop({ type: Object, default: null })
  payload: Record<string, unknown> | null;
}

export const HubWebhookFailedSchema =
  SchemaFactory.createForClass(HubWebhookFailed);
