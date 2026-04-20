import { Injectable } from "@nestjs/common";
import { UserRepository } from "./user.repository";
import { User } from "./user.entity";

@Injectable()
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  /**
   * Get the user's Meridian-side record, creating it on first access.
   * Called on every `GET /me` — the user's first sign-in is just the
   * first call that results in an insert.
   */
  async upsertBySub(sub: string): Promise<User> {
    const existing = await this.repository.findBySub(sub);
    if (existing) return existing;
    const created = User.create({
      sub,
      hasCompletedOnboarding: false,
      timezone: null,
    });
    if (!created.ok) throw created.error;
    await this.repository.save(created.value);
    return created.value;
  }

  async completeOnboarding(sub: string, timezone: string): Promise<User> {
    const user = await this.upsertBySub(sub);
    user.completeOnboarding(timezone);
    await this.repository.save(user);
    return user;
  }

  // Cascade from Hub user.deleted event.
  async deleteAllForUser(sub: string): Promise<number> {
    return this.repository.deleteBySub(sub);
  }
}
