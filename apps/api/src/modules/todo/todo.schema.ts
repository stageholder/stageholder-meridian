import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type TodoDocument = TodoModel & Document<string>;

@Schema({
  collection: 'todos',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class TodoModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) title: string;
  @Prop({ type: String }) description: string;
  @Prop({ type: String, required: true, index: true, default: 'todo' }) status: string;
  @Prop({ type: String, required: true, default: 'none' }) priority: string;
  @Prop({ type: String, index: true }) due_date: string;
  @Prop({ type: String, required: true, index: true }) list_id: string;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: String, index: true }) assignee_id: string;
  @Prop({ type: String, required: true }) creator_id: string;
  @Prop({ type: Number, default: 0 }) order: number;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const TodoSchema = SchemaFactory.createForClass(TodoModel);
TodoSchema.index({ workspace_id: 1, list_id: 1, order: 1 });
TodoSchema.index({ workspace_id: 1, status: 1 });
