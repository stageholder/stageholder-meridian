import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "./notification.repository";
import { Notification } from "./notification.entity";
import {
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

export interface CreateNotificationParams {
  userSub: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
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

  async listForUser(
    userSub: string,
    unreadOnly = false,
  ): Promise<Notification[]> {
    return this.repository.findByUser(userSub, unreadOnly);
  }

  async listForUserPaginated(
    userSub: string,
    unreadOnly: boolean,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ReturnType<Notification["toObject"]>>> {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByUserPaginated(
      userSub,
      unreadOnly,
      p,
      l,
    );
    return {
      data: docs.map((d) => d.toObject()),
      meta: buildPaginationMeta(total, p, l),
    };
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Notification[]> {
    return this.repository.findUpdatedSince(userSub, since, includeSoftDeleted);
  }

  async markAsRead(userSub: string, id: string): Promise<void> {
    const notification = await this.repository.findById(userSub, id);
    if (!notification) throw new Error("Notification not found");
    notification.markAsRead();
    await this.repository.save(notification);
  }

  async getUnreadCount(userSub: string): Promise<number> {
    return this.repository.countUnread(userSub);
  }

  async markAllRead(userSub: string): Promise<void> {
    await this.repository.markAllRead(userSub);
  }

  // Purge every notification for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
