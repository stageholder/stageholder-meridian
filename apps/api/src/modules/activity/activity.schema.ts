import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { randomUUID } from 'crypto';

export type ActivityDocument = ActivityModel & Document<string>;

@Schema({
  collection: 'activities',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class ActivityModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true }) actor_id: string;
  @Prop({ type: String, required: true }) action: string;
  @Prop({ type: String, required: true }) entity_type: string;
  @Prop({ type: String, required: true, index: true }) entity_id: string;
  @Prop({ type: String, required: true }) entity_title: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) changes: Record<string, { from: unknown; to: unknown }>;
  @Prop({ type: MongooseSchema.Types.Mixed }) metadata: Record<string, unknown>;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(ActivityModel);
ActivitySchema.index({ entity_type: 1, entity_id: 1 });
ActivitySchema.index({ workspace_id: 1, created_at: -1 });
