import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import type { StageholderUser } from "@stageholder/auth";
import { TodoRepository } from "./todo.repository";
import { Todo, TodoStatus } from "./todo.entity";
import {
  CreateTodoDto,
  UpdateTodoDto,
  ReorderTodosDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderSubtasksDto,
} from "./todo.dto";
import { LightService } from "../light/light.service";
import { enforceLimit } from "../../common/helpers/entitlement";
import {
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class TodoService {
  private readonly logger = new Logger(TodoService.name);
  constructor(
    private readonly repository: TodoRepository,
    private readonly lightService: LightService,
  ) {}

  async create(
    userSub: string,
    dto: CreateTodoDto,
    user: StageholderUser,
  ): Promise<Todo> {
    await enforceLimit(user, "max_active_todos", () =>
      this.repository.countActiveForUser(userSub),
    );
    const order = await this.repository.countByList(userSub, dto.listId);
    const result = Todo.create({
      title: dto.title,
      description: dto.description,
      status: dto.status || "todo",
      priority: dto.priority || "none",
      dueDate: dto.dueDate,
      doDate: dto.doDate,
      listId: dto.listId,
      userSub,
      order,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    this.lightService
      .awardTodoCreate(userSub, result.value.id)
      .catch((err) =>
        this.logger.warn(
          "Failed to award light for todo creation",
          err.message,
        ),
      );
    return result.value;
  }

  async findById(userSub: string, id: string): Promise<Todo> {
    const todo = await this.repository.findById(userSub, id);
    if (!todo) throw new NotFoundException("Todo not found");
    return todo;
  }

  async listByList(userSub: string, listId: string): Promise<Todo[]> {
    return this.repository.findByList(userSub, listId);
  }

  async listByUser(
    userSub: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ReturnType<Todo["toObject"]>>> {
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

  async update(userSub: string, id: string, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findById(userSub, id);
    if (dto.title !== undefined) todo.updateTitle(dto.title);
    if (dto.description !== undefined)
      todo.updateDescription(dto.description || undefined);
    if (dto.status !== undefined) todo.updateStatus(dto.status as TodoStatus);
    if (dto.priority !== undefined) todo.updatePriority(dto.priority);
    if (dto.dueDate !== undefined) todo.updateDueDate(dto.dueDate || undefined);
    if (dto.doDate !== undefined) todo.updateDoDate(dto.doDate || undefined);
    await this.repository.save(todo);
    if (dto.status === "done") {
      this.lightService
        .awardTodoComplete(userSub, id, todo.priority)
        .catch((err) => this.logger.warn("Failed to award light", err.message));
    }
    return todo;
  }

  async updateStatus(
    userSub: string,
    id: string,
    status: TodoStatus,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, id);
    todo.updateStatus(status);
    await this.repository.save(todo);
    if (status === "done") {
      this.lightService
        .awardTodoComplete(userSub, id, todo.priority)
        .catch((err) => this.logger.warn("Failed to award light", err.message));
    }
    return todo;
  }

  async reorder(userSub: string, dto: ReorderTodosDto): Promise<void> {
    for (const item of dto.items) {
      const todo = await this.repository.findById(userSub, item.id);
      if (todo) {
        todo.updateOrder(item.order);
        await this.repository.save(todo);
      }
    }
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<ReturnType<Todo["toObject"]>[]> {
    const todos = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return todos.map((t) => t.toObject());
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every todo for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }

  async addSubtask(
    userSub: string,
    todoId: string,
    dto: CreateSubtaskDto,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, todoId);
    const result = todo.addSubtask(dto.title, dto.priority);
    if (!result.ok) throw new BadRequestException(result.error.message);
    await this.repository.save(todo);
    return todo;
  }

  async updateSubtask(
    userSub: string,
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, todoId);
    const result = todo.updateSubtask(subtaskId, dto);
    if (!result.ok) throw new NotFoundException("Subtask not found");
    await this.repository.save(todo);
    return todo;
  }

  async removeSubtask(
    userSub: string,
    todoId: string,
    subtaskId: string,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, todoId);
    const result = todo.removeSubtask(subtaskId);
    if (!result.ok) throw new NotFoundException("Subtask not found");
    await this.repository.save(todo);
    return todo;
  }

  async reorderSubtasks(
    userSub: string,
    todoId: string,
    dto: ReorderSubtasksDto,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, todoId);
    todo.reorderSubtasks(dto.items);
    await this.repository.save(todo);
    return todo;
  }
}
