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
import { HabitGroupService } from "./habit-group.service";
import {
  CreateHabitGroupDto,
  UpdateHabitGroupDto,
  ReorderHabitGroupsDto,
} from "./habit-group.dto";
import {
  CreateHabitGroupDto as CreateSchema,
  UpdateHabitGroupDto as UpdateSchema,
  ReorderHabitGroupsDto as ReorderSchema,
} from "./habit-group.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Habit Groups")
@Controller("habit-groups")
export class HabitGroupController {
  constructor(private readonly service: HabitGroupService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitGroupDto,
  ) {
    return (await this.service.create(req.user.sub, dto, req.user)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
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
    return this.service.findByUser(req.user.sub);
  }

  @Post("reorder")
  async reorder(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderHabitGroupsDto,
  ) {
    await this.service.reorder(req.user.sub, dto);
    return { reordered: true };
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitGroupDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
