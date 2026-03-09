import { Injectable } from '@nestjs/common';
import { FeedbackRepository } from './feedback.repository';
import { Feedback } from './feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(private readonly repository: FeedbackRepository) {}

  async create(userId: string, type: 'general' | 'bug' | 'feature', message: string): Promise<Feedback> {
    const result = Feedback.create({ userId, type, message });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }
}
