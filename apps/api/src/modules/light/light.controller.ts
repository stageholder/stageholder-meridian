import { Controller, Get, Query } from '@nestjs/common';
import { LightService } from './light.service';
import { GetLightEventsQuery } from './light.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('light')
export class LightController {
  constructor(private readonly service: LightService) {}

  @Get('me')
  async getMyLight(@CurrentUserId() userId: string) {
    const userLight = await this.service.getUserLight(userId);
    return userLight.toObject();
  }

  @Get('events')
  async getEvents(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(GetLightEventsQuery)) query: GetLightEventsQuery,
  ) {
    const { docs, total } = await this.service.getEvents(userId, query.limit, query.offset);
    return {
      data: docs.map((e) => e.toObject()),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }
}
