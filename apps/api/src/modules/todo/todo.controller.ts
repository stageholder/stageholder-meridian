import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TodoService } from "./todo.service";
import {
  CreateTodoDto,
  UpdateTodoDto,
  ReorderTodosDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderSubtasksDto,
} from "./todo.dto";
import {
  CreateTodoDto as CreateSchema,
  UpdateTodoDto as UpdateSchema,
  ReorderTodosDto as ReorderSchema,
  CreateSubtaskDto as CreateSubtaskSchema,
  UpdateSubtaskDto as UpdateSubtaskSchema,
  ReorderSubtasksDto as ReorderSubtasksSchema,
} from "./todo.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Todos")
@Controller("workspaces/:workspaceId/todos")
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Post()
  async create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTodoDto,
  ) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Query("listId") listId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        workspaceId,
        userId,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }

    if (listId) {
      return (await this.service.listByList(listId, workspaceId, userId)).map(
        (t) => t.toObject(),
      );
    }
    return this.service.listByWorkspace(
      workspaceId,
      userId,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get(":id")
  async get(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    return (await this.service.findById(id, workspaceId, userId)).toObject();
  }

  @Patch(":id")
  async update(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTodoDto,
  ) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
  }

  @Post("reorder")
  async reorder(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderTodosDto,
  ) {
    await this.service.reorder(workspaceId, userId, dto);
    return { reordered: true };
  }

  @Post(":id/subtasks")
  async addSubtask(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateSubtaskSchema)) dto: CreateSubtaskDto,
  ) {
    return (
      await this.service.addSubtask(id, workspaceId, userId, dto)
    ).toObject();
  }

  @Post(":id/subtasks/reorder")
  async reorderSubtasks(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ReorderSubtasksSchema)) dto: ReorderSubtasksDto,
  ) {
    return (
      await this.service.reorderSubtasks(id, workspaceId, userId, dto)
    ).toObject();
  }

  @Patch(":id/subtasks/:subtaskId")
  async updateSubtask(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Param("subtaskId") subtaskId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateSubtaskSchema)) dto: UpdateSubtaskDto,
  ) {
    return (
      await this.service.updateSubtask(id, subtaskId, workspaceId, userId, dto)
    ).toObject();
  }

  @Delete(":id/subtasks/:subtaskId")
  async removeSubtask(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Param("subtaskId") subtaskId: string,
    @CurrentUserId() userId: string,
  ) {
    return (
      await this.service.removeSubtask(id, subtaskId, workspaceId, userId)
    ).toObject();
  }

  @Delete(":id")
  async delete(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.delete(id, workspaceId, userId);
    return { deleted: true };
  }
}
