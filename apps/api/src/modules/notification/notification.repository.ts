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
          recipient_id: data.recipientId,
          type: data.type,
          title: data.title,
          message: data.message,
          entity_type: data.entityType,
          entity_id: data.entityId,
          actor_id: data.actorId,
          read: data.read,
          read_at: data.readAt,
          workspace_id: data.workspaceId,
        },
      },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<Notification | null> {
    const doc = await this.model
      .findById(id)
      .where({ deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByRecipient(
    recipientId: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    const filter: any = { recipient_id: recipientId, deleted_at: null };
    if (unreadOnly) filter.read = false;
    const docs = await this.model.find(filter).sort({ created_at: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByRecipientPaginated(
    recipientId: string,
    unreadOnly: boolean,
    page: number,
    limit: number,
  ): Promise<{ docs: Notification[]; total: number }> {
    const filter: any = { recipient_id: recipientId, deleted_at: null };
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

  async countUnread(recipientId: string): Promise<number> {
    return this.model.countDocuments({
      recipient_id: recipientId,
      read: false,
      deleted_at: null,
    });
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.model.updateMany(
      { recipient_id: recipientId, read: false, deleted_at: null },
      { $set: { read: true, read_at: new Date() } },
    );
  }

  async delete(id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { $set: { deleted_at: new Date() } },
    );
  }

  private toDomain(doc: any): Notification {
    return Notification.reconstitute(
      {
        recipientId: doc.recipient_id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        entityType: doc.entity_type,
        entityId: doc.entity_id,
        actorId: doc.actor_id,
        read: doc.read,
        readAt: doc.read_at,
        workspaceId: doc.workspace_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
