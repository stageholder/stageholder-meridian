import { Controller, Post, Body } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() body: { type: 'general' | 'bug' | 'feature'; message: string },
  ) {
    await this.service.create(userId, body.type, body.message);
    return { success: true };
  }
}
