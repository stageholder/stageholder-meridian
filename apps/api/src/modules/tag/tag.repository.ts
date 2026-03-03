import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TagModel, TagDocument } from './tag.schema';
import { Tag } from './tag.entity';

@Injectable()
export class TagRepository {
  constructor(@InjectModel(TagModel.name) private model: Model<TagDocument>) {}

  async save(tag: Tag): Promise<void> {
    const data = tag.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { name: data.name, color: data.color, workspace_id: data.workspaceId } }, { upsert: true });
  }

  async findById(id: string): Promise<Tag | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Tag[]> {
    const docs = await this.model.find({ workspace_id: workspaceId }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<void> { await this.model.deleteOne({ _id: id }); }

  private toDomain(doc: any): Tag {
    return Tag.reconstitute({ name: doc.name, color: doc.color, workspaceId: doc.workspace_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
