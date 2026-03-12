import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkspaceMemberService } from "./workspace-member.service";
import { WorkspaceService } from "../workspace/workspace.service";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("Invitations")
@Controller("invitations")
export class InvitationController {
  constructor(
    private readonly memberService: WorkspaceMemberService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Public()
  @Get(":token")
  async peek(@Param("token") token: string) {
    const member = await this.memberService.getInvitationByToken(token);
    if (!member) throw new NotFoundException("Invitation not found");
    const workspace = await this.workspaceService.findById(member.workspaceId);
    return {
      workspaceName: workspace.name,
      role: member.role,
      email: member.email,
      expired: member.isExpired(),
    };
  }

  @Post(":token/accept")
  async accept(@Param("token") token: string, @CurrentUserId() userId: string) {
    const member = await this.memberService.acceptInvitation(token, userId);
    const workspace = await this.workspaceService.findById(member.workspaceId);
    return { ...member.toObject(), workspaceShortId: workspace.shortId };
  }
}
