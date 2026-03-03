import { Injectable, NotFoundException } from '@nestjs/common';
import { TodoRepository } from './todo.repository';
import { Todo, TodoStatus } from './todo.entity';
import { CreateTodoDto, UpdateTodoDto, ReorderTodosDto } from './todo.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class TodoService {
  constructor(private readonly repository: TodoRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(workspaceId: string, userId: string, dto: CreateTodoDto): Promise<Todo> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const order = await this.repository.countByList(dto.listId);
    const result = Todo.create({ title: dto.title, description: dto.description, status: dto.status || 'todo', priority: dto.priority || 'none', dueDate: dto.dueDate, listId: dto.listId, workspaceId, assigneeId: dto.assigneeId, creatorId: userId, order });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<Todo> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const todo = await this.repository.findById(id);
    if (!todo || todo.workspaceId !== workspaceId) throw new NotFoundException('Todo not found');
    return todo;
  }

  async listByList(listId: string, workspaceId: string, userId: string): Promise<Todo[]> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    return this.repository.findByList(listId);
  }

  async listByWorkspace(workspaceId: string, userId: string, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<Todo['toObject']>>> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspacePaginated(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findById(id, workspaceId, userId);
    if (dto.title) todo.updateTitle(dto.title);
    if (dto.description !== undefined) todo.updateDescription(dto.description || undefined);
    if (dto.status) todo.updateStatus(dto.status as TodoStatus);
    if (dto.priority) todo.updatePriority(dto.priority);
    if (dto.dueDate !== undefined) todo.updateDueDate(dto.dueDate || undefined);
    if (dto.assigneeId !== undefined) todo.updateAssigneeId(dto.assigneeId || undefined);
    await this.repository.save(todo);
    return todo;
  }

  async updateStatus(id: string, workspaceId: string, userId: string, status: TodoStatus): Promise<Todo> {
    const todo = await this.findById(id, workspaceId, userId);
    todo.updateStatus(status);
    await this.repository.save(todo);
    return todo;
  }

  async reorder(workspaceId: string, userId: string, dto: ReorderTodosDto): Promise<void> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    for (const item of dto.items) {
      const todo = await this.repository.findById(item.id);
      if (todo && todo.workspaceId === workspaceId) {
        todo.updateOrder(item.order);
        await this.repository.save(todo);
      }
    }
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
