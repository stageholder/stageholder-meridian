import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { TodoListService } from './todo-list.service';
import { CreateTodoListDto, UpdateTodoListDto } from './todo-list.dto';
import { CreateTodoListDto as CreateSchema, UpdateTodoListDto as UpdateSchema } from './todo-list.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/todo-lists')
export class TodoListController {
  constructor(private readonly service: TodoListService) {}

  @Post()
  async create(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTodoListDto) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string) {
    return (await this.service.findByWorkspace(workspaceId, userId)).map((l) => l.toObject());
  }

  @Get(':id')
  async get(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    return (await this.service.findById(id, workspaceId, userId)).toObject();
  }

  @Patch(':id')
  async update(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTodoListDto) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
  }

  @Delete(':id')
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    await this.service.delete(id, workspaceId, userId);
    return { deleted: true };
  }
}
