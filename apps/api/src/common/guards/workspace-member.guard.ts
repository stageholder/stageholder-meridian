import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { WorkspaceMemberService } from '../../modules/workspace-member/workspace-member.service';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly memberService: WorkspaceMemberService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const workspaceId = request.params?.workspaceId;
    if (!userId || !workspaceId) throw new ForbiddenException('Workspace access denied');
    const isMember = await this.memberService.isMember(workspaceId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this workspace');
    request.workspaceId = workspaceId;
    return true;
  }
}
