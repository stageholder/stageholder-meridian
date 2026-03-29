import { Injectable, ConflictException } from "@nestjs/common";
import { UserRepository } from "./user.repository";
import { User, AuthProvider } from "./user.entity";

@Injectable()
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async createLocal(
    email: string,
    name: string,
    passwordHash: string,
    timezone?: string,
  ): Promise<User> {
    const existing = await this.repository.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");
    const result = User.create({
      email: email.toLowerCase(),
      name,
      passwordHash,
      provider: AuthProvider.LOCAL,
      emailVerified: false,
      ...(timezone ? { timezone } : {}),
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }
  async findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
  async findByIds(ids: string[]): Promise<User[]> {
    return this.repository.findByIds(ids);
  }

  async findOrCreateGoogle(
    email: string,
    name: string,
    providerId: string,
    avatar?: string,
  ): Promise<User> {
    const existing = await this.repository.findByProviderId(
      "google",
      providerId,
    );
    if (existing) {
      if (avatar && existing.avatar !== avatar) {
        existing.updateAvatar(avatar);
        await this.repository.save(existing);
      }
      return existing;
    }
    const byEmail = await this.repository.findByEmail(email);
    if (byEmail) {
      if (avatar && byEmail.avatar !== avatar) {
        byEmail.updateAvatar(avatar);
        await this.repository.save(byEmail);
      }
      return byEmail;
    }
    const result = User.create({
      email: email.toLowerCase(),
      name,
      provider: AuthProvider.GOOGLE,
      providerId,
      emailVerified: true,
      avatar,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async updateUser(user: User): Promise<void> {
    await this.repository.save(user);
  }
}
