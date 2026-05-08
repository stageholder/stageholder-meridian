import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserModel, UserDocument } from "./user.schema";
import { User } from "./user.entity";

@Injectable()
export class UserRepository implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @InjectModel(UserModel.name) private model: Model<UserDocument>,
  ) {}

  // The pre-Hub schema declared `email` as a unique field, leaving an
  // `email_1` index in production MongoDB. The current schema doesn't store
  // email at all, so every new insert lands `email: null` and the second
  // signup collides on the unique constraint (E11000). Drop the stale index
  // once at boot — idempotent (NamespaceNotFound after the first deploy).
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.model.collection.dropIndex("email_1");
      this.logger.log("Dropped legacy email_1 index from users collection");
    } catch (err: any) {
      const code = err?.code ?? err?.codeName;
      if (code === 27 || code === "IndexNotFound") return;
      this.logger.warn(
        `Could not drop legacy email_1 index: ${err?.message ?? err}`,
      );
    }
  }

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
