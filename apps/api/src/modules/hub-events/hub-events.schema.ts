import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HubEventsCursorDocument = HydratedDocument<HubEventsCursor>;

// One cursor doc per product (we only run one — meridian — but the schema
// allows multiples so we can reuse the collection later). `_id` is the
// cursor key (currently always "meridian"); `cursor` stores the ISO
// timestamp of the last event we processed, which we pass back to Hub as
// the `since` query param on the next poll.
@Schema({ collection: "hub_events_cursor", timestamps: true })
export class HubEventsCursor {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, default: null })
  cursor: string | null;
}

export const HubEventsCursorSchema =
  SchemaFactory.createForClass(HubEventsCursor);

export type HubEventFailedDocument = HydratedDocument<HubEventFailed>;

// Dead-letter collection for events whose handler threw. We still advance
// the main cursor past them so head-of-line blocking doesn't halt every
// subsequent user's cascade, but the failure is recorded here for the
// operator to review and retry manually. Without this, a single bad event
// would silently drop a GDPR-grade cleanup on the floor.
@Schema({ collection: "hub_events_failed", timestamps: true })
export class HubEventFailed {
  @Prop({ type: String, required: true })
  _id: string; // = Hub event id

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
}

export const HubEventFailedSchema =
  SchemaFactory.createForClass(HubEventFailed);
