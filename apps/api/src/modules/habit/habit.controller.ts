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
import { HabitService } from "./habit.service";
import { CreateHabitDto, UpdateHabitDto, ReorderHabitsDto } from "./habit.dto";
import {
  CreateHabitDto as CreateSchema,
  UpdateHabitDto as UpdateSchema,
  ReorderHabitsDto as ReorderSchema,
} from "./habit.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Habits")
@Controller("habits")
export class HabitController {
  constructor(private readonly service: HabitService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitDto,
  ) {
    return (await this.service.create(req.user.sub, dto, req.user)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
    @Query("archivedOnly") archivedOnly?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        req.user.sub,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }
    if (archivedOnly === "true") {
      return this.service.listArchived(req.user.sub);
    }
    return this.service.listByUser(
      req.user.sub,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Post("reorder")
  async reorder(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderHabitsDto,
  ) {
    await this.service.reorder(req.user.sub, dto);
    return { reordered: true };
  }

  @Post(":id/archive")
  async archive(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.archive(req.user.sub, id)).toObject();
  }

  @Post(":id/unarchive")
  async unarchive(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.unarchive(req.user.sub, id)).toObject();
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
