import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const workspaceId = request.params?.workspaceId;
    if (!userId || !workspaceId) throw new ForbiddenException('Workspace access denied');
    // Full implementation will inject WorkspaceMemberService once the module exists
    // For now, this is a placeholder that checks required params exist
    return true;
  }
}
