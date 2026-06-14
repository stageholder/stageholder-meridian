import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type HabitGroupDocument = HabitGroupModel & Document<string>;

@Schema({
  collection: "habit_groups",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class HabitGroupModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String }) color: string;
  @Prop({ type: String }) icon: string;
  @Prop({ type: Number, required: true, default: 0 }) order: number;
  @Prop({ type: String, required: true, index: true }) userSub: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const HabitGroupSchema = SchemaFactory.createForClass(HabitGroupModel);
HabitGroupSchema.index({ userSub: 1, order: 1 });
