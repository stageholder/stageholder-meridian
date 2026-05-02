import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserModel, UserDocument } from "./user.schema";
import { User } from "./user.entity";

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(UserModel.name) private model: Model<UserDocument>,
  ) {}

  async findBySub(sub: string): Promise<User | null> {
    const doc = await this.model.findOne({ sub }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async save(user: User): Promise<void> {
    const data = user.toObject();
    await this.model.updateOne(
      { sub: data.sub },
      {
        $set: {
          sub: data.sub,
          has_completed_onboarding: data.hasCompletedOnboarding,
        },
      },
      { upsert: true },
    );
  }

  // Hard-delete this user's row. Used by the Hub user.deleted cascade.
  async deleteBySub(sub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ sub });
    return deletedCount ?? 0;
  }

  private toDomain(doc: any): User {
    return User.reconstitute(
      {
        sub: doc.sub,
        hasCompletedOnboarding: !!doc.has_completed_onboarding,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
