import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { TodoService } from './todo.service';
import { CreateTodoDto, UpdateTodoDto, ReorderTodosDto } from './todo.dto';
import { CreateTodoDto as CreateSchema, UpdateTodoDto as UpdateSchema, ReorderTodosDto as ReorderSchema } from './todo.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('workspaces/:workspaceId/todos')
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Post()
  async create(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTodoDto) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Query('listId') listId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (listId) {
      return (await this.service.listByList(listId, workspaceId, userId)).map((t) => t.toObject());
    }
    return this.service.listByWorkspace(workspaceId, userId, page ? +page : undefined, limit ? +limit : undefined);
  }

  @Get(':id')
  async get(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    return (await this.service.findById(id, workspaceId, userId)).toObject();
  }

  @Patch(':id')
  async update(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTodoDto) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
  }

  @Post('reorder')
  async reorder(@Param('workspaceId') workspaceId: string, @CurrentUserId() userId: string, @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderTodosDto) {
    await this.service.reorder(workspaceId, userId, dto);
    return { reordered: true };
  }

  @Delete(':id')
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @CurrentUserId() userId: string) {
    await this.service.delete(id, workspaceId, userId);
    return { deleted: true };
  }
}
