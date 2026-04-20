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
import { TagService } from "./tag.service";
import { CreateTagDto, UpdateTagDto } from "./tag.dto";
import {
  CreateTagDto as CreateSchema,
  UpdateTagDto as UpdateSchema,
} from "./tag.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Tags")
@Controller("tags")
export class TagController {
  constructor(private readonly service: TagService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateTagDto,
  ) {
    return (await this.service.create(req.user.sub, dto)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
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
      ).map((t) => t.toObject());
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
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateTagDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
