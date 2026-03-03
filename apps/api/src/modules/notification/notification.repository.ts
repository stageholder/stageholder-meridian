import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationModel, NotificationDocument } from './notification.schema';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationRepository {
  constructor(@InjectModel(NotificationModel.name) private model: Model<NotificationDocument>) {}

  async save(notification: Notification): Promise<void> {
    const data = notification.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { recipient_id: data.recipientId, type: data.type, title: data.title, message: data.message, entity_type: data.entityType, entity_id: data.entityId, actor_id: data.actorId, read: data.read, read_at: data.readAt, workspace_id: data.workspaceId } }, { upsert: true });
  }

  async findById(id: string): Promise<Notification | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByRecipient(recipientId: string, unreadOnly: boolean): Promise<Notification[]> {
    const filter: any = { recipient_id: recipientId };
    if (unreadOnly) filter.read = false;
    const docs = await this.model.find(filter).sort({ created_at: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.model.countDocuments({ recipient_id: recipientId, read: false });
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.model.updateMany({ recipient_id: recipientId, read: false }, { $set: { read: true, read_at: new Date() } });
  }

  async delete(id: string): Promise<void> { await this.model.deleteOne({ _id: id }); }

  private toDomain(doc: any): Notification {
    return Notification.reconstitute({ recipientId: doc.recipient_id, type: doc.type, title: doc.title, message: doc.message, entityType: doc.entity_type, entityId: doc.entity_id, actorId: doc.actor_id, read: doc.read, readAt: doc.read_at, workspaceId: doc.workspace_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
