import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { TagService } from './tag.service';
import { CreateTagDto, UpdateTagDto } from './tag.dto';
import { CreateTagDto as CreateSchema, UpdateTagDto as UpdateSchema } from './tag.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/tags')
export class TagController {
  constructor(private readonly service: TagService) {}

  @Post()
  async create(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTagDto) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string) {
    return (await this.service.findByWorkspace(workspaceId, userId)).map((t) => t.toObject());
  }

  @Get(':id')
  async get(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    return (await this.service.findById(id, workspaceId, userId)).toObject();
  }

  @Patch(':id')
  async update(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTagDto) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
  }

  @Delete(':id')
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    await this.service.delete(id, workspaceId, userId);
    return { deleted: true };
  }
}
