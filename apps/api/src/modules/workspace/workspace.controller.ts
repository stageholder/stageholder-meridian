import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkspaceService } from "./workspace.service";
import { CreateWorkspaceDto, UpdateWorkspaceDto } from "./workspace.dto";
import {
  CreateWorkspaceDto as CreateSchema,
  UpdateWorkspaceDto as UpdateSchema,
} from "./workspace.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import {
  CurrentUserId,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";

@ApiTags("Workspaces")
@Controller("workspaces")
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Post()
  async create(
    @CurrentUser() user: { sub: string; email: string },
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateWorkspaceDto,
  ) {
    const ws = await this.service.create(user.sub, user.email, dto);
    return ws.toObject();
  }

  @Get()
  async list(@CurrentUserId() userId: string) {
    return (await this.service.findByUser(userId)).map((ws) => ws.toObject());
  }

  @Get(":identifier")
  async get(
    @Param("identifier") identifier: string,
    @CurrentUserId() userId: string,
  ) {
    return (await this.service.resolve(identifier, userId)).toObject();
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateWorkspaceDto,
  ) {
    return (await this.service.update(id, userId, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.service.delete(id, userId);
    return { deleted: true };
  }
}
