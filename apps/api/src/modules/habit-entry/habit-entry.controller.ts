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
import { HabitEntryService } from "./habit-entry.service";
import { CreateHabitEntryDto, UpdateHabitEntryDto } from "./habit-entry.dto";
import {
  CreateHabitEntryDto as CreateSchema,
  UpdateHabitEntryDto as UpdateSchema,
} from "./habit-entry.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Habit Entries")
@Controller("habit-entries")
export class HabitEntrySyncController {
  constructor(private readonly service: HabitEntryService) {}

  @Get()
  async listAll(
    @Req() req: StageholderRequest,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
    @Query("limit") _limit?: string,
  ) {
    if (!updatedSince) {
      return [];
    }
    return (
      await this.service.findUpdatedSince(
        req.user.sub,
        updatedSince,
        includeSoftDeleted === "true",
      )
    ).map((e) => e.toObject());
  }
}

@ApiTags("Habit Entries")
@Controller("habits/:habitId/entries")
export class HabitEntryController {
  constructor(private readonly service: HabitEntryService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Param("habitId") habitId: string,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitEntryDto,
  ) {
    return (await this.service.create(req.user.sub, habitId, dto)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Param("habitId") habitId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return (
        await this.service.findUpdatedSince(
          req.user.sub,
          updatedSince,
          includeSoftDeleted === "true",
        )
      ).map((e) => e.toObject());
    }
    if (page || limit) {
      return this.service.listByHabitPaginated(
        req.user.sub,
        habitId,
        page ? +page : undefined,
        limit ? +limit : undefined,
      );
    }
    return (
      await this.service.listByHabit(req.user.sub, habitId, startDate, endDate)
    ).map((e) => e.toObject());
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitEntryDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
