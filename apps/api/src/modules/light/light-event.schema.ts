import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type LightEventDocument = LightEventModel & Document<string>;

@Schema({
  collection: 'light_events',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class LightEventModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true }) workspace_id: string;
  @Prop({ type: String, required: true }) action: string;
  @Prop({ type: Number, required: true }) base_light: number;
  @Prop({ type: Number, required: true }) multiplier: number;
  @Prop({ type: Number, required: true }) total_light: number;
  @Prop({ type: String, required: true, index: true }) date: string;
  @Prop({ type: Object }) metadata: Record<string, unknown>;
}

export const LightEventSchema = SchemaFactory.createForClass(LightEventModel);
LightEventSchema.index({ user_id: 1, date: -1 });
LightEventSchema.index({ user_id: 1, action: 1, date: 1 });
