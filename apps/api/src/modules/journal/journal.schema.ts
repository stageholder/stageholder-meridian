import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
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
  @Prop({ type: String, default: "" }) content: string;
  @Prop({ type: Number }) mood: number;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: String, required: true, index: true }) author_id: string;
  @Prop({ type: String, required: true, index: true }) date: string;
  @Prop({ type: Number, default: 0 }) word_count: number;
  @Prop({ type: Boolean, default: false }) encrypted: boolean;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const JournalSchema = SchemaFactory.createForClass(JournalModel);
JournalSchema.index({ workspace_id: 1, date: -1 });
