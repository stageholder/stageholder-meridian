import { Controller, Get, Patch, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async list(@CurrentUserId() userId: string, @Query('unread') unread?: string) {
    const unreadOnly = unread === 'true';
    return (await this.service.listForUser(userId, unreadOnly)).map((n) => n.toObject());
  }

  @Get('unread-count')
  async unreadCount(@CurrentUserId() userId: string) {
    const count = await this.service.getUnreadCount(userId);
    return { count };
  }

  @Patch('read-all')
  async readAll(@CurrentUserId() userId: string) {
    await this.service.markAllRead(userId);
    return { success: true };
  }
}
