import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TagModel, TagDocument } from "./tag.schema";
import { Tag } from "./tag.entity";

@Injectable()
export class TagRepository {
  constructor(@InjectModel(TagModel.name) private model: Model<TagDocument>) {}

  async save(tag: Tag): Promise<void> {
    const data = tag.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: data.name,
          color: data.color,
          workspace_id: data.workspaceId,
        },
      },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<Tag | null> {
    const doc = await this.model.findOne({ _id: id, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Tag[]> {
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspacePaginated(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Tag[]; total: number }> {
    const total = await this.model.countDocuments({
      workspace_id: workspaceId,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async delete(id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { $set: { deleted_at: new Date() } },
    );
  }

  async findUpdatedSince(
    workspaceId: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Tag[]> {
    const filter: any = {
      workspace_id: workspaceId,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Tag {
    return Tag.reconstitute(
      {
        name: doc.name,
        color: doc.color,
        workspaceId: doc.workspace_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
