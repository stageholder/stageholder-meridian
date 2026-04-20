import { Controller, Get, Patch, Body, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LightService } from "./light.service";
import { GetLightEventsQuery, UpdateTargetsDto } from "./light.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Light")
@Controller("light")
export class LightController {
  constructor(private readonly service: LightService) {}

  @Get("me")
  async getMyLight(@Req() req: StageholderRequest) {
    const userLight = await this.service.getUserLight(req.user.sub);
    return userLight.toObject();
  }

  @Patch("targets")
  async updateTargets(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(UpdateTargetsDto)) dto: UpdateTargetsDto,
  ) {
    const userLight = await this.service.updateTargets(req.user.sub, dto);
    return userLight.toObject();
  }

  @Get("stats")
  async getStats(
    @Req() req: StageholderRequest,
    @Query("today") today?: string,
  ) {
    return this.service.getStats(req.user.sub, today);
  }

  @Get("events")
  async getEvents(
    @Req() req: StageholderRequest,
    @Query(new ZodValidationPipe(GetLightEventsQuery))
    query: GetLightEventsQuery,
  ) {
    const { docs, total } = await this.service.getEvents(
      req.user.sub,
      query.limit,
      query.offset,
    );
    return {
      data: docs.map((e) => e.toObject()),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }
}
