import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/activities')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listByWorkspace(workspaceId, userId, page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined);
  }
}
