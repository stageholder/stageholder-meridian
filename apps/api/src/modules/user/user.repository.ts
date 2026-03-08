import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserModel, UserDocument } from './user.schema';
import { User, AuthProvider } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(UserModel.name) private model: Model<UserDocument>) {}

  async save(user: User): Promise<void> {
    const data = user.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          email: data.email,
          name: data.name,
          password_hash: data.passwordHash,
          provider: data.provider,
          provider_id: data.providerId,
          email_verified: data.emailVerified,
          avatar: data.avatar,
          timezone: data.timezone,
          onboarding_completed: data.onboardingCompleted,
        },
      },
      { upsert: true },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.model.findOne({ email: email.toLowerCase() }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const docs = await this.model.find({ _id: { $in: ids } }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByProviderId(provider: string, providerId: string): Promise<User | null> {
    const doc = await this.model.findOne({ provider, provider_id: providerId }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  private toDomain(doc: any): User {
    return User.reconstitute(
      {
        email: doc.email,
        name: doc.name,
        passwordHash: doc.password_hash,
        provider: doc.provider as AuthProvider,
        providerId: doc.provider_id,
        emailVerified: doc.email_verified,
        avatar: doc.avatar,
        timezone: doc.timezone,
        onboardingCompleted: doc.onboarding_completed ?? true,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
