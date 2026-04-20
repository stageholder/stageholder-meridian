import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ActivityModel, ActivityDocument } from "./activity.schema";
import { Activity } from "./activity.entity";

@Injectable()
export class ActivityRepository {
  constructor(
    @InjectModel(ActivityModel.name) private model: Model<ActivityDocument>,
  ) {}

  async save(activity: Activity): Promise<void> {
    const data = activity.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          userSub: data.userSub,
          action: data.action,
          entity_type: data.entityType,
          entity_id: data.entityId,
          entity_title: data.entityTitle,
          changes: data.changes,
          metadata: data.metadata,
        },
      },
      { upsert: true },
    );
  }

  async findByUser(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Activity[]; total: number }> {
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

  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findByEntity(
    userSub: string,
    entityType: string,
    entityId: string,
  ): Promise<Activity[]> {
    const docs = await this.model
      .find({
        userSub,
        entity_type: entityType,
        entity_id: entityId,
        deleted_at: null,
      })
      .sort({ created_at: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Activity {
    return Activity.reconstitute(
      {
        userSub: doc.userSub,
        action: doc.action,
        entityType: doc.entity_type,
        entityId: doc.entity_id,
        entityTitle: doc.entity_title,
        changes: doc.changes,
        metadata: doc.metadata,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
