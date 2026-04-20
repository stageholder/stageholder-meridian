import { Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { StageholderRequest } from "../../common/types";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("unread") unread?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return (
        await this.service.findUpdatedSince(
          req.user.sub,
          updatedSince,
          includeSoftDeleted === "true",
        )
      ).map((n) => n.toObject());
    }
    const unreadOnly = unread === "true";
    return this.service.listForUserPaginated(
      req.user.sub,
      unreadOnly,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get("unread-count")
  async unreadCount(@Req() req: StageholderRequest) {
    const count = await this.service.getUnreadCount(req.user.sub);
    return { count };
  }

  @Patch(":id/read")
  async markAsRead(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.markAsRead(req.user.sub, id);
    return { success: true };
  }

  @Patch("read-all")
  async readAll(@Req() req: StageholderRequest) {
    await this.service.markAllRead(req.user.sub);
    return { success: true };
  }
}
