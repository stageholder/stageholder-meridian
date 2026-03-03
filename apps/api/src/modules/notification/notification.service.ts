import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { Notification } from './notification.entity';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

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

  async listForUserPaginated(userId: string, unreadOnly: boolean, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<Notification['toObject']>>> {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByRecipientPaginated(userId, unreadOnly, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId);
  }
}
