import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NotificationModel, NotificationDocument } from "./notification.schema";
import { Notification } from "./notification.entity";

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(NotificationModel.name)
    private model: Model<NotificationDocument>,
  ) {}

  async save(notification: Notification): Promise<void> {
    const data = notification.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          userSub: data.userSub,
          type: data.type,
          title: data.title,
          message: data.message,
          entity_type: data.entityType,
          entity_id: data.entityId,
          read: data.read,
          read_at: data.readAt,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<Notification | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(
    userSub: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    const filter: any = { userSub, deleted_at: null };
    if (unreadOnly) filter.read = false;
    const docs = await this.model.find(filter).sort({ created_at: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserPaginated(
    userSub: string,
    unreadOnly: boolean,
    page: number,
    limit: number,
  ): Promise<{ docs: Notification[]; total: number }> {
    const filter: any = { userSub, deleted_at: null };
    if (unreadOnly) filter.read = false;
    const total = await this.model.countDocuments(filter);
    const docs = await this.model
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async countUnread(userSub: string): Promise<number> {
    return this.model.countDocuments({
      userSub,
      read: false,
      deleted_at: null,
    });
  }

  async markAllRead(userSub: string): Promise<void> {
    await this.model.updateMany(
      { userSub, read: false, deleted_at: null },
      { $set: { read: true, read_at: new Date() } },
    );
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every notification for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Notification[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Notification {
    return Notification.reconstitute(
      {
        userSub: doc.userSub,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        entityType: doc.entity_type,
        entityId: doc.entity_id,
        read: doc.read,
        readAt: doc.read_at,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
