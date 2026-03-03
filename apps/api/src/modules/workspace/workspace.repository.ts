import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkspaceModel, WorkspaceDocument } from './workspace.schema';
import { Workspace } from './workspace.entity';

@Injectable()
export class WorkspaceRepository {
  constructor(@InjectModel(WorkspaceModel.name) private model: Model<WorkspaceDocument>) {}

  async save(workspace: Workspace): Promise<void> {
    const data = workspace.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { name: data.name, slug: data.slug, description: data.description, owner_id: data.ownerId } }, { upsert: true });
  }

  async findById(id: string): Promise<Workspace | null> {
    const doc = await this.model.findById(id).where({ deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const doc = await this.model.findOne({ slug, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  private toDomain(doc: any): Workspace {
    return Workspace.reconstitute({ name: doc.name, slug: doc.slug, description: doc.description, ownerId: doc.owner_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
