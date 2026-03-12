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
import { ConfigService } from "@nestjs/config";
import { WorkspaceMemberService } from "./workspace-member.service";
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  InviteMemberDto as InviteSchema,
  UpdateMemberRoleDto as UpdateRoleSchema,
} from "./workspace-member.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";
import { UserService } from "../user/user.service";

@ApiTags("Workspace Members")
@Controller("workspaces/:workspaceId/members")
export class WorkspaceMemberController {
  private readonly frontendUrl: string;

  constructor(
    private readonly service: WorkspaceMemberService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
  }

  @Post("invite")
  async invite(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(InviteSchema)) dto: InviteMemberDto,
  ) {
    await this.service.requireRole(workspaceId, userId, ["owner", "admin"]);
    const member = await this.service.invite(workspaceId, dto);
    const obj = member.toObject();
    return {
      ...obj,
      inviteLink: `${this.frontendUrl}/invite/${obj.invitationToken}`,
    };
  }

  @Get()
  async list(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    await this.service.requireRole(workspaceId, userId, [
      "owner",
      "admin",
      "member",
      "viewer",
    ]);
    return this.service.listMembersPaginated(
      workspaceId,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Patch(":memberId")
  async updateRole(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateMemberRoleDto,
  ) {
    await this.service.requireRole(workspaceId, userId, ["owner", "admin"]);
    return (
      await this.service.updateRole(memberId, workspaceId, dto)
    ).toObject();
  }

  @Get("assignable")
  async assignable(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.requireRole(workspaceId, userId, [
      "owner",
      "admin",
      "member",
      "viewer",
    ]);
    const userIds = await this.service.listAcceptedMemberUserIds(workspaceId);
    const users = await this.userService.findByIds(userIds);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
    }));
  }

  @Post("resend/:memberId")
  async resend(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.requireRole(workspaceId, userId, ["owner", "admin"]);
    const member = await this.service.resendInvitation(memberId, workspaceId);
    const obj = member.toObject();
    return {
      ...obj,
      inviteLink: `${this.frontendUrl}/invite/${obj.invitationToken}`,
    };
  }

  @Post("cancel/:memberId")
  async cancel(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.requireRole(workspaceId, userId, ["owner", "admin"]);
    await this.service.cancelInvitation(memberId, workspaceId);
    return { cancelled: true };
  }

  @Post("leave")
  async leave(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.leaveWorkspace(workspaceId, userId);
    return { left: true, redirect: "/workspaces" };
  }

  @Delete(":memberId")
  async remove(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.service.requireRole(workspaceId, userId, ["owner", "admin"]);
    await this.service.removeMember(memberId, workspaceId);
    return { deleted: true };
  }
}
