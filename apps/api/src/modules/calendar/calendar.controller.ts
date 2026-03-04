import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get()
  async getMonthData(
    @Param('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
    @Query('month') month?: string,
  ) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month query param required in YYYY-MM format');
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr!, 10);
    const mo = parseInt(monthStr!, 10);

    const firstDay = new Date(Date.UTC(year, mo - 1, 1));
    const lastDay = new Date(Date.UTC(year, mo, 0));

    const gridStart = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate() - firstDay.getUTCDay()));
    const gridEnd = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate() + (6 - lastDay.getUTCDay())));

    const startDate = gridStart.toISOString().split('T')[0]!;
    const endDate = gridEnd.toISOString().split('T')[0]!;

    return this.service.getMonthData(workspaceId, userId, startDate, endDate);
  }
}
