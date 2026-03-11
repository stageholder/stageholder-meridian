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
import { HabitService } from "./habit.service";
import { CreateHabitDto, UpdateHabitDto } from "./habit.dto";
import {
  CreateHabitDto as CreateSchema,
  UpdateHabitDto as UpdateSchema,
} from "./habit.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Habits")
@Controller("workspaces/:workspaceId/habits")
export class HabitController {
  constructor(private readonly service: HabitService) {}

  @Post()
  async create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitDto,
  ) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(
    @Param("workspaceId") wsId: string,
    @CurrentUserId() userId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        wsId,
        userId,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }

    return this.service.listByWorkspace(
      wsId,
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
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitDto,
  ) {
    return (await this.service.update(id, workspaceId, userId, dto)).toObject();
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
