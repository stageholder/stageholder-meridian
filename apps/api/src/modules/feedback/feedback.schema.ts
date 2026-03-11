import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type FeedbackDocument = FeedbackModel & Document<string>;

@Schema({
  collection: "feedbacks",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class FeedbackModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true, enum: ["general", "bug", "feature"] })
  type: string;
  @Prop({ type: String, required: true }) message: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(FeedbackModel);
