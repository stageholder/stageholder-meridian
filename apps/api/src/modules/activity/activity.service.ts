import { Injectable } from '@nestjs/common';
import { ActivityRepository } from './activity.repository';
import { Activity, ActivityChanges } from './activity.entity';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

export interface LogActivityParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  changes?: ActivityChanges;
  metadata?: Record<string, unknown>;
  workspaceId: string;
}

@Injectable()
export class ActivityService {
  constructor(private readonly repository: ActivityRepository, private readonly memberService: WorkspaceMemberService) {}

  async log(params: LogActivityParams): Promise<Activity> {
    const result = Activity.create(params);
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async listByWorkspace(workspaceId: string, userId: string, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<Activity['toObject']>>> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspace(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }
}
