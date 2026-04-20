import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type UserLightDocument = UserLightModel & Document<string>;

@Schema({
  collection: "user_lights",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class UserLightModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, unique: true, index: true })
  userSub: string;
  @Prop({ type: Number, default: 0 }) total_light: number;
  @Prop({ type: Number, default: 1 }) current_tier: number;
  @Prop({ type: String, default: "Stargazer" }) current_title: string;
  @Prop({ type: Number, default: 0 }) perfect_day_streak: number;
  @Prop({ type: Number, default: 0 }) todo_ring_streak: number;
  @Prop({ type: Number, default: 0 }) habit_ring_streak: number;
  @Prop({ type: Number, default: 0 }) journal_ring_streak: number;
  @Prop({ type: String, default: null }) last_active_date: string;
  @Prop({ type: String, default: null }) last_finalized_date: string;
  @Prop({ type: Object, default: null }) finalized_streaks: {
    todo: number;
    habit: number;
    journal: number;
    perfect: number;
  } | null;
  @Prop({ type: Number, default: 0 }) longest_perfect_streak: number;
  @Prop({ type: Number, default: 0 }) perfect_days_total: number;
  @Prop({ type: Number, default: 3 }) todo_target_daily: number;
  @Prop({ type: Number, default: 75 }) journal_target_daily_words: number;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const UserLightSchema = SchemaFactory.createForClass(UserLightModel);
