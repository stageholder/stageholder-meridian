import { Injectable, NotFoundException } from '@nestjs/common';
import { TodoListRepository } from './todo-list.repository';
import { TodoList } from './todo-list.entity';
import { CreateTodoListDto, UpdateTodoListDto } from './todo-list.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class TodoListService {
  constructor(private readonly repository: TodoListRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(workspaceId: string, userId: string, dto: CreateTodoListDto): Promise<TodoList> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const result = TodoList.create({ name: dto.name, color: dto.color, icon: dto.icon, workspaceId, isShared: dto.isShared ?? false, creatorId: userId });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByWorkspace(workspaceId: string, userId: string, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<TodoList['toObject']>>> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspacePaginated(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<TodoList> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const list = await this.repository.findById(id);
    if (!list || list.workspaceId !== workspaceId) throw new NotFoundException('Todo list not found');
    return list;
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateTodoListDto): Promise<TodoList> {
    const list = await this.findById(id, workspaceId, userId);
    if (dto.name) list.updateName(dto.name);
    if (dto.color !== undefined) list.updateColor(dto.color);
    if (dto.icon !== undefined) list.updateIcon(dto.icon);
    if (dto.isShared !== undefined) list.updateIsShared(dto.isShared);
    await this.repository.save(list);
    return list;
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
