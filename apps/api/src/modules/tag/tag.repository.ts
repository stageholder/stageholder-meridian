import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TagModel, TagDocument } from "./tag.schema";
import { Tag } from "./tag.entity";

@Injectable()
export class TagRepository implements OnApplicationBootstrap {
  private readonly logger = new Logger(TagRepository.name);

  constructor(@InjectModel(TagModel.name) private model: Model<TagDocument>) {}

  // The pre-Hub schema enforced (workspace_id, name) unique. The current
  // schema scopes by `userSub`, doesn't write `workspace_id`, and declares
  // its own `userSub_1_name_1` unique index. The legacy index would otherwise
  // collapse to "globally unique tag names across all new users" — the second
  // user to create a tag named "work" would E11000 on (null, "work"). Drop
  // it at boot.
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.model.collection.dropIndex("workspace_id_1_name_1");
      this.logger.log("Dropped legacy workspace_id_1_name_1 index from tags");
    } catch (err: any) {
      const code = err?.code ?? err?.codeName;
      if (code === 27 || code === "IndexNotFound") return;
      this.logger.warn(
        `Could not drop legacy workspace_id_1_name_1 index: ${err?.message ?? err}`,
      );
    }
  }

  async save(tag: Tag): Promise<void> {
    const data = tag.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: data.name,
          color: data.color,
          userSub: data.userSub,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<Tag | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<Tag[]> {
    const docs = await this.model.find({ userSub, deleted_at: null }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserPaginated(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Tag[]; total: number }> {
    const total = await this.model.countDocuments({
      userSub,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every tag for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Tag[]> {
    const filter: any = {
      userSub,
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
        userSub: doc.userSub,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
