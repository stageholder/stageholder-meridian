import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type WorkspaceDocument = WorkspaceModel & Document<string>;

@Schema({
  collection: 'workspaces',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class WorkspaceModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String, required: true, unique: true, index: true }) short_id: string;
  @Prop({ type: String }) description: string;
  @Prop({ type: String, required: true, index: true }) owner_id: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const WorkspaceSchema = SchemaFactory.createForClass(WorkspaceModel);
