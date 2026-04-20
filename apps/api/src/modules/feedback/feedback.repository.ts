import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FeedbackModel, FeedbackDocument } from "./feedback.schema";
import { Feedback } from "./feedback.entity";

@Injectable()
export class FeedbackRepository {
  constructor(
    @InjectModel(FeedbackModel.name) private model: Model<FeedbackDocument>,
  ) {}

  async save(feedback: Feedback): Promise<void> {
    const data = feedback.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          userSub: data.userSub,
          type: data.type,
          message: data.message,
        },
      },
      { upsert: true },
    );
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ docs: Feedback[]; total: number }> {
    const filter = { deleted_at: null };
    const total = await this.model.countDocuments(filter);
    const docs = await this.model
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  private toDomain(doc: any): Feedback {
    return Feedback.reconstitute(
      {
        userSub: doc.userSub,
        type: doc.type,
        message: doc.message,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
