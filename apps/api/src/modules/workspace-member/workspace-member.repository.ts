import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkspaceMemberModel, WorkspaceMemberDocument } from './workspace-member.schema';
import { WorkspaceMember, MemberRole, InvitationStatus } from './workspace-member.entity';

@Injectable()
export class WorkspaceMemberRepository {
  constructor(@InjectModel(WorkspaceMemberModel.name) private model: Model<WorkspaceMemberDocument>) {}

  async save(member: WorkspaceMember): Promise<void> {
    const data = member.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { workspace_id: data.workspaceId, user_id: data.userId, email: data.email, role: data.role, invitation_status: data.invitationStatus, invitation_token: data.invitationToken } }, { upsert: true });
  }

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const doc = await this.model.findOne({ workspace_id: workspaceId, user_id: userId, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspaceAndEmail(workspaceId: string, email: string): Promise<WorkspaceMember | null> {
    const doc = await this.model.findOne({ workspace_id: workspaceId, email: email.toLowerCase(), deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByToken(token: string): Promise<WorkspaceMember | null> {
    const doc = await this.model.findOne({ invitation_token: token, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<WorkspaceMember[]> {
    const docs = await this.model.find({ user_id: userId, invitation_status: 'accepted', deleted_at: null }).lean();
    return docs.map((d) => this.toDomain(d));
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null }).lean();
    return docs.map((d) => this.toDomain(d));
  }

  async findByWorkspacePaginated(workspaceId: string, page: number, limit: number): Promise<{ docs: WorkspaceMember[]; total: number }> {
    const filter = { workspace_id: workspaceId, deleted_at: null };
    const total = await this.model.countDocuments(filter);
    const docs = await this.model.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { docs: docs.map((d) => this.toDomain(d)), total };
  }

  async findById(id: string): Promise<WorkspaceMember | null> {
    const doc = await this.model.findById(id).where({ deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  private toDomain(doc: any): WorkspaceMember {
    return WorkspaceMember.reconstitute({ workspaceId: doc.workspace_id, userId: doc.user_id, email: doc.email, role: doc.role as MemberRole, invitationStatus: doc.invitation_status as InvitationStatus, invitationToken: doc.invitation_token, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
