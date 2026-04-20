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
import { JournalService } from "./journal.service";
import { CreateJournalDto, UpdateJournalDto } from "./journal.dto";
import {
  CreateJournalDto as CreateSchema,
  UpdateJournalDto as UpdateSchema,
} from "./journal.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Journals")
@Controller("journals")
export class JournalController {
  constructor(private readonly service: JournalService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateJournalDto,
  ) {
    return (await this.service.create(req.user.sub, dto)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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

    return this.service.listByUser(
      req.user.sub,
      startDate,
      endDate,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get("stats")
  async getStats(
    @Req() req: StageholderRequest,
    @Query("today") today?: string,
  ) {
    return this.service.getStats(req.user.sub, today);
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateJournalDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
