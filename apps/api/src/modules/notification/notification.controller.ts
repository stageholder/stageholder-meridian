import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query("unread") unread?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return (
        await this.service.findUpdatedSince(
          userId,
          updatedSince,
          includeSoftDeleted === "true",
        )
      ).map((n) => n.toObject());
    }
    const unreadOnly = unread === "true";
    return this.service.listForUserPaginated(
      userId,
      unreadOnly,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get("unread-count")
  async unreadCount(@CurrentUserId() userId: string) {
    const count = await this.service.getUnreadCount(userId);
    return { count };
  }

  @Patch(":id/read")
  async markAsRead(@CurrentUserId() userId: string, @Param("id") id: string) {
    await this.service.markAsRead(userId, id);
    return { success: true };
  }

  @Patch("read-all")
  async readAll(@CurrentUserId() userId: string) {
    await this.service.markAllRead(userId);
    return { success: true };
  }
}
