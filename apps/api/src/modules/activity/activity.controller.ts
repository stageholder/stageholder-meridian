import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ActivityService } from "./activity.service";
import { StageholderRequest } from "../../common/types";

@ApiTags("Activity")
@Controller("activities")
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.listByUser(
      req.user.sub,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
