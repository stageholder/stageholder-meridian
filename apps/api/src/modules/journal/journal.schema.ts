import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { randomUUID } from "crypto";

export type JournalDocument = JournalModel & Document<string>;

@Schema({
  collection: "journals",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class JournalModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) title: string;
  // `content` was string-only (HTML) before the Phase 2 migration. As of the
  // dual-format window it's `Mixed` so each row carries either an HTML
  // string (legacy) or a TipTap JSON object (new). Mongoose stores both
  // shapes without translation. Discriminator at read time: `typeof
  // doc.content === "string"` → legacy HTML, else JSON.
  //
  // Once the lazy backfill window closes (no string rows remain), we can
  // narrow back to a structured sub-schema or keep Mixed for forward
  // extensibility (mentions, embeds, custom nodes carry their own attrs).
  @Prop({ type: MongooseSchema.Types.Mixed, default: "" }) content:
    | string
    | Record<string, unknown>;
  @Prop({ type: Number }) mood: number;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: String, required: true, index: true }) userSub: string;
  @Prop({ type: String, required: true, index: true }) date: string;
  @Prop({ type: Number, default: 0 }) word_count: number;
  @Prop({ type: Boolean, default: false }) encrypted: boolean;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const JournalSchema = SchemaFactory.createForClass(JournalModel);
JournalSchema.index({ userSub: 1, date: -1 });
JournalSchema.index({ userSub: 1, updated_at: -1 });
