import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackModel, FeedbackDocument } from './feedback.schema';
import { Feedback } from './feedback.entity';

@Injectable()
export class FeedbackRepository {
  constructor(@InjectModel(FeedbackModel.name) private model: Model<FeedbackDocument>) {}

  async save(feedback: Feedback): Promise<void> {
    const data = feedback.toObject();
    await this.model.updateOne(
      { _id: data.id },
      { $set: { user_id: data.userId, type: data.type, message: data.message } },
      { upsert: true },
    );
  }
}
