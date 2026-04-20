import { Injectable } from "@nestjs/common";
import { ActivityRepository } from "./activity.repository";
import { Activity, ActivityChanges } from "./activity.entity";
import {
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

export interface LogActivityParams {
  userSub: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  changes?: ActivityChanges;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async log(params: LogActivityParams): Promise<Activity> {
    const result = Activity.create(params);
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }

  async listByUser(
    userSub: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ReturnType<Activity["toObject"]>>> {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByUser(userSub, p, l);
    return {
      data: docs.map((d) => d.toObject()),
      meta: buildPaginationMeta(total, p, l),
    };
  }
}
