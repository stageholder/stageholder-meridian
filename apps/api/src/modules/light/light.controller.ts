import { Controller, Get, Patch, Body, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LightService } from "./light.service";
import { GetLightEventsQuery, UpdateTargetsDto } from "./light.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Light")
@Controller("light")
export class LightController {
  constructor(private readonly service: LightService) {}

  @Get("me")
  async getMyLight(@CurrentUserId() userId: string) {
    const userLight = await this.service.getUserLight(userId);
    return userLight.toObject();
  }

  @Patch("targets")
  async updateTargets(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateTargetsDto)) dto: UpdateTargetsDto,
  ) {
    const userLight = await this.service.updateTargets(userId, dto);
    return userLight.toObject();
  }

  @Get("stats")
  async getStats(
    @CurrentUserId() userId: string,
    @Query("today") today?: string,
  ) {
    return this.service.getStats(userId, today);
  }

  @Get("events")
  async getEvents(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(GetLightEventsQuery))
    query: GetLightEventsQuery,
  ) {
    const { docs, total } = await this.service.getEvents(
      userId,
      query.limit,
      query.offset,
    );
    return {
      data: docs.map((e) => e.toObject()),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }
}
