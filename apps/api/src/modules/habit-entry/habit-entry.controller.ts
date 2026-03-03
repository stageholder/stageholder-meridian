import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { HabitEntryService } from './habit-entry.service';
import { CreateHabitEntryDto, UpdateHabitEntryDto } from './habit-entry.dto';
import { CreateHabitEntryDto as CreateSchema, UpdateHabitEntryDto as UpdateSchema } from './habit-entry.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/habits/:habitId/entries')
export class HabitEntryController {
  constructor(private readonly service: HabitEntryService) {}

  @Post()
  async create(@Param('workspaceId') workspaceId: string, @Param('habitId') habitId: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitEntryDto) {
    return (await this.service.create(habitId, workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(@Param('workspaceId') workspaceId: string, @Param('habitId') habitId: string, @CurrentUserId() userId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (page || limit) {
      return this.service.listByHabitPaginated(habitId, workspaceId, userId, page ? +page : undefined, limit ? +limit : undefined);
    }
    return (await this.service.listByHabit(habitId, workspaceId, userId, startDate, endDate)).map((e) => e.toObject());
  }

  @Get(':id')
  async get(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    return (await this.service.findById(id, workspaceId, userId)).toObject();
  }

  @Patch(':id')
  async update(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitEntryDto) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
  }

  @Delete(':id')
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    await this.service.delete(id, workspaceId, userId);
    return { deleted: true };
  }
}
