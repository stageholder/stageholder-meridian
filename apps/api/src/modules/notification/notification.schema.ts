import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type NotificationDocument = NotificationModel & Document<string>;

@Schema({
  collection: "notifications",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class NotificationModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) recipient_id: string;
  @Prop({ type: String, required: true }) type: string;
  @Prop({ type: String, required: true }) title: string;
  @Prop({ type: String, required: true }) message: string;
  @Prop({ type: String }) entity_type: string;
  @Prop({ type: String }) entity_id: string;
  @Prop({ type: String }) actor_id: string;
  @Prop({ type: Boolean, default: false, index: true }) read: boolean;
  @Prop({ type: Date }) read_at: Date;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const NotificationSchema =
  SchemaFactory.createForClass(NotificationModel);
NotificationSchema.index({ recipient_id: 1, read: 1, created_at: -1 });
