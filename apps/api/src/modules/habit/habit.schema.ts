import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type HabitDocument = HabitModel & Document<string>;

@Schema({
  collection: "habits",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class HabitModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String }) description: string;
  @Prop({ type: String, required: true, default: "daily" }) frequency: string;
  @Prop({ type: Number, required: true, default: 1 }) target_count: number;
  @Prop({ type: [Number], default: undefined }) scheduled_days: number[];
  @Prop({ type: String }) unit: string;
  @Prop({ type: String }) color: string;
  @Prop({ type: String }) icon: string;
  @Prop({ type: String, required: true, index: true }) userSub: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const HabitSchema = SchemaFactory.createForClass(HabitModel);
HabitSchema.index({ userSub: 1, created_at: -1 });
