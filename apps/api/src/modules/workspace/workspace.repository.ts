import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkspaceModel, WorkspaceDocument } from './workspace.schema';
import { Workspace } from './workspace.entity';
import { generateShortId } from '../../shared';

@Injectable()
export class WorkspaceRepository {
  constructor(@InjectModel(WorkspaceModel.name) private model: Model<WorkspaceDocument>) {}

  async save(workspace: Workspace): Promise<void> {
    const data = workspace.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { name: data.name, short_id: data.shortId, description: data.description, owner_id: data.ownerId } }, { upsert: true });
  }

  async findById(id: string): Promise<Workspace | null> {
    const doc = await this.model.findById(id).where({ deleted_at: null }).lean();
    if (!doc) return null;
    await this.backfillShortId(doc);
    return this.toDomain(doc);
  }

  async findByShortId(shortId: string): Promise<Workspace | null> {
    const doc = await this.model.findOne({ short_id: shortId, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  private async backfillShortId(doc: any): Promise<void> {
    if (!doc.short_id) {
      doc.short_id = generateShortId();
      await this.model.updateOne({ _id: doc._id }, { $set: { short_id: doc.short_id } });
    }
  }

  private toDomain(doc: any): Workspace {
    return Workspace.reconstitute({ name: doc.name, shortId: doc.short_id, description: doc.description, ownerId: doc.owner_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
