import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type WorkspaceMemberDocument = WorkspaceMemberModel & Document<string>;

@Schema({
  collection: 'workspace_members',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class WorkspaceMemberModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: String, index: true }) user_id: string;
  @Prop({ type: String, required: true, lowercase: true }) email: string;
  @Prop({ type: String, required: true, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' }) role: string;
  @Prop({ type: String, required: true, enum: ['pending', 'accepted'], default: 'pending' }) invitation_status: string;
  @Prop({ type: String }) invitation_token: string;
}

export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMemberModel);
WorkspaceMemberSchema.index({ workspace_id: 1, user_id: 1 }, { unique: true, sparse: true });
WorkspaceMemberSchema.index({ workspace_id: 1, email: 1 }, { unique: true });
WorkspaceMemberSchema.index({ invitation_token: 1 }, { sparse: true });
