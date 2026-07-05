import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common";
import type { StageholderUser } from "@stageholder/sdk/core";
import { TodoRepository } from "./todo.repository";
import { TodoListRepository } from "../todo-list/todo-list.repository";
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
    // Circular by design: todo-list needs TodoRepository for its delete
    // cascade, and todo needs TodoListRepository to validate a todo's target
    // list. forwardRef breaks the resolution cycle.
    @Inject(forwardRef(() => TodoListRepository))
    private readonly listRepository: TodoListRepository,
    private readonly lightService: LightService,
  ) {}

  /**
   * Assert the given list exists and belongs to the user. Guards create and
   * move-between-lists so a todo can never point at a foreign or non-existent
   * list id.
   */
  private async assertOwnsList(userSub: string, listId: string): Promise<void> {
    const list = await this.listRepository.findById(userSub, listId);
    if (!list) throw new NotFoundException("Todo list not found");
  }

  async create(
    userSub: string,
    dto: CreateTodoDto,
    user: StageholderUser,
  ): Promise<Todo> {
    await enforceLimit(user, "max_active_todos", () =>
      this.repository.countActiveForUser(userSub),
    );
    await this.assertOwnsList(userSub, dto.listId);
    const order = await this.repository.countByList(userSub, dto.listId);
    const result = Todo.create({
      title: dto.title,
      description: dto.description,
      status: "todo",
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

  async update(
    userSub: string,
    id: string,
    dto: UpdateTodoDto,
    user: StageholderUser,
  ): Promise<Todo> {
    const todo = await this.findById(userSub, id);
    const wasDone = todo.status === "done";

    if (dto.title !== undefined) todo.updateTitle(dto.title);
    if (dto.description !== undefined)
      todo.updateDescription(dto.description || undefined);
    if (dto.priority !== undefined) todo.updatePriority(dto.priority);
    if (dto.dueDate !== undefined) todo.updateDueDate(dto.dueDate || undefined);
    if (dto.doDate !== undefined) todo.updateDoDate(dto.doDate || undefined);

    // Move between lists: validate the destination is one the user owns, then
    // re-slot the todo at the end of the target list's ordering.
    if (dto.listId !== undefined && dto.listId !== todo.listId) {
      await this.assertOwnsList(userSub, dto.listId);
      const order = await this.repository.countByList(userSub, dto.listId);
      todo.updateListId(dto.listId);
      todo.updateOrder(order);
    }

    // Status transition. Re-opening a done todo grows the active count, so it
    // must respect the same cap as create — otherwise the limit is trivially
    // bypassed by completing then re-opening. The entity owns the completedAt
    // lifecycle inside updateStatus.
    if (dto.status !== undefined && dto.status !== todo.status) {
      if (dto.status === "todo" && wasDone) {
        await enforceLimit(user, "max_active_todos", () =>
          this.repository.countActiveForUser(userSub),
        );
      }
      todo.updateStatus(dto.status as TodoStatus);
    }

    await this.repository.save(todo);

    // Award completion Light only on a genuine todo→done edge — not on every
    // edit that happens to carry status:"done", and not when re-completing an
    // already-done todo (the light service also dedups per day as a backstop).
    if (dto.status === "done" && !wasDone) {
      this.lightService
        .awardTodoComplete(userSub, id, todo.priority)
        .catch((err) => this.logger.warn("Failed to award light", err.message));
    }
    return todo;
  }

  async reorder(userSub: string, dto: ReorderTodosDto): Promise<void> {
    await this.repository.reorder(userSub, dto.items);
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
