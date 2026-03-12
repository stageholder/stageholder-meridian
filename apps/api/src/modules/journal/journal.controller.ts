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
import { JournalService } from "./journal.service";
import { CreateJournalDto, UpdateJournalDto } from "./journal.dto";
import {
  CreateJournalDto as CreateSchema,
  UpdateJournalDto as UpdateSchema,
} from "./journal.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Journals")
@Controller("workspaces/:workspaceId/journals")
export class JournalController {
  constructor(private readonly service: JournalService) {}

  @Post()
  async create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateJournalDto,
  ) {
    return (await this.service.create(workspaceId, userId, dto)).toObject();
  }

  @Get()
  async list(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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

    return this.service.listByWorkspace(
      workspaceId,
      userId,
      startDate,
      endDate,
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
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateJournalDto,
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
