import { Injectable } from '@nestjs/common';
import { FeedbackRepository } from './feedback.repository';
import { Feedback } from './feedback.entity';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class FeedbackService {
  constructor(private readonly repository: FeedbackRepository) {}

  async create(userId: string, type: 'general' | 'bug' | 'feature', message: string): Promise<Feedback> {
    const result = Feedback.create({ userId, type, message });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async list(page?: number, limit?: number): Promise<PaginatedResult<ReturnType<Feedback['toObject']>>> {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findAllPaginated(p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }
}
