import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type TagDocument = TagModel & Document<string>;

@Schema({
  collection: 'tags',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class TagModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String, default: '#6B7280' }) color: string;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const TagSchema = SchemaFactory.createForClass(TagModel);
TagSchema.index({ workspace_id: 1, name: 1 }, { unique: true });
