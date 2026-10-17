import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { DashboardTodayQuery } from "./dashboard.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";
import { todayKey } from "../../common/request-timezone";

@ApiTags("Dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("today")
  async today(
    @Req() req: StageholderRequest,
    @Query(new ZodValidationPipe(DashboardTodayQuery))
    query: DashboardTodayQuery,
  ) {
    const today = query.today ?? todayKey();
    return this.dashboard.getToday(req.user.sub, today);
  }
}
