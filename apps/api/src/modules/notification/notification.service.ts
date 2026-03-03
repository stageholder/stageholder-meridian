import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { Notification } from './notification.entity';

export interface CreateNotificationParams {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  workspaceId: string;
}

@Injectable()
export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
    const result = Notification.create({ ...params, read: false });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async listForUser(userId: string, unreadOnly = false): Promise<Notification[]> {
    return this.repository.findByRecipient(userId, unreadOnly);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId);
  }
}
