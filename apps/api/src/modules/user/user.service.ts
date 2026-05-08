import { Injectable, Logger } from "@nestjs/common";
import { UserRepository } from "./user.repository";
import { User } from "./user.entity";
import { LegacyMigrationService } from "./legacy-migration.service";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly repository: UserRepository,
    private readonly legacyMigration: LegacyMigrationService,
  ) {}

  /**
   * Get the user's Meridian-side record, creating it on first access.
   * Called on every `GET /me` — the user's first sign-in is just the
   * first call that results in an insert.
   *
   * On the *insert* path, the legacy-migration service runs once to
   * rewire any pre-Hub data the user had under their email to the
   * new `sub`. Migration failures must not block first-login provisioning.
   */
  async upsertBySub(sub: string, email: string | null = null): Promise<User> {
    const existing = await this.repository.findBySub(sub);
    if (existing) return existing;
    const created = User.create({
      sub,
      hasCompletedOnboarding: false,
    });
    if (!created.ok) throw created.error;
    await this.repository.save(created.value);
    try {
      await this.legacyMigration.migrateIfLegacy(sub, email);
    } catch (err) {
      this.logger.warn(
        `Legacy migration failed for sub=${sub} email=${email}: ${(err as Error).message}`,
      );
    }
    return created.value;
  }

  async completeOnboarding(
    sub: string,
    email: string | null = null,
  ): Promise<User> {
    const user = await this.upsertBySub(sub, email);
    user.completeOnboarding();
    await this.repository.save(user);
    return user;
  }

  // Cascade from Hub user.deleted event.
  async deleteAllForUser(sub: string): Promise<number> {
    return this.repository.deleteBySub(sub);
  }
}
