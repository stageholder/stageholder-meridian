import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import type { StageholderUser } from "@stageholder/sdk/core";
import { TodoListRepository } from "./todo-list.repository";
import { TodoList } from "./todo-list.entity";
import { CreateTodoListDto, UpdateTodoListDto } from "./todo-list.dto";
import { TodoRepository } from "../todo/todo.repository";
import { enforceLimit } from "../../common/helpers/entitlement";
import {
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class TodoListService {
  constructor(
    private readonly repository: TodoListRepository,
    private readonly todoRepository: TodoRepository,
  ) {}

  private async ensureDefaultList(userSub: string): Promise<void> {
    const existing = await this.repository.findDefaultByUser(userSub);
    if (existing) return;
    const result = TodoList.create({
      name: "Inbox",
      color: "#3b82f6",
      userSub,
      isDefault: true,
    });
    if (!result.ok) return;
    try {
      await this.repository.save(result.value);
    } catch (err: any) {
      if (err?.code === 11000) return;
      throw err;
    }
  }

  async create(
    userSub: string,
    dto: CreateTodoListDto,
    user: StageholderUser,
  ): Promise<TodoList> {
    await enforceLimit(user, "max_todo_lists", () =>
      this.repository.countForUser(userSub),
    );
    const result = TodoList.create({
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByUser(
    userSub: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ReturnType<TodoList["toObject"]>>> {
    await this.ensureDefaultList(userSub);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByUserPaginated(
      userSub,
      p,
      l,
    );
    return {
      data: docs.map((d) => d.toObject()),
      meta: buildPaginationMeta(total, p, l),
    };
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<ReturnType<TodoList["toObject"]>[]> {
    const lists = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return lists.map((l) => l.toObject());
  }

  async findById(userSub: string, id: string): Promise<TodoList> {
    const list = await this.repository.findById(userSub, id);
    if (!list) throw new NotFoundException("Todo list not found");
    return list;
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateTodoListDto,
  ): Promise<TodoList> {
    const list = await this.findById(userSub, id);
    if (dto.name) list.updateName(dto.name);
    if (dto.color !== undefined) list.updateColor(dto.color);
    if (dto.icon !== undefined) list.updateIcon(dto.icon);
    await this.repository.save(list);
    return list;
  }

  async delete(userSub: string, id: string): Promise<void> {
    const list = await this.findById(userSub, id);
    if (list.isDefault)
      throw new ForbiddenException("Cannot delete the default Inbox list");
    await this.todoRepository.deleteByList(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every todo list for the user. Used by the Hub user.deleted cascade.
  // Todos themselves are purged independently by TodoService.deleteAllForUser,
  // so we only need to drop the list rows here.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
