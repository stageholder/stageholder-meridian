import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
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
import { StageholderRequest } from "../../common/types";

@ApiTags("Todos")
@Controller("todos")
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTodoDto,
  ) {
    return (await this.service.create(req.user.sub, dto, req.user)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("listId") listId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        req.user.sub,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }

    if (listId) {
      return (await this.service.listByList(req.user.sub, listId)).map((t) =>
        t.toObject(),
      );
    }
    return this.service.listByUser(
      req.user.sub,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTodoDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Post("reorder")
  async reorder(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderTodosDto,
  ) {
    await this.service.reorder(req.user.sub, dto);
    return { reordered: true };
  }

  @Post(":id/subtasks")
  async addSubtask(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateSubtaskSchema)) dto: CreateSubtaskDto,
  ) {
    return (await this.service.addSubtask(req.user.sub, id, dto)).toObject();
  }

  @Post(":id/subtasks/reorder")
  async reorderSubtasks(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReorderSubtasksSchema)) dto: ReorderSubtasksDto,
  ) {
    return (
      await this.service.reorderSubtasks(req.user.sub, id, dto)
    ).toObject();
  }

  @Patch(":id/subtasks/:subtaskId")
  async updateSubtask(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Param("subtaskId") subtaskId: string,
    @Body(new ZodValidationPipe(UpdateSubtaskSchema)) dto: UpdateSubtaskDto,
  ) {
    return (
      await this.service.updateSubtask(req.user.sub, id, subtaskId, dto)
    ).toObject();
  }

  @Delete(":id/subtasks/:subtaskId")
  async removeSubtask(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Param("subtaskId") subtaskId: string,
  ) {
    return (
      await this.service.removeSubtask(req.user.sub, id, subtaskId)
    ).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
