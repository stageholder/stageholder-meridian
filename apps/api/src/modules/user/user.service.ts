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
   * The legacy-migration service runs on **every** login, not only on
   * insert. It's fully idempotent (every step filters on "missing userSub"
   * / "no existing journal_security" / "empty auto-Inbox"), so re-runs are
   * cheap no-ops once a user is migrated. This handles the case where a
   * legacy user logged in *before* the JIT migration code shipped — their
   * Hub user record was created without migration, and tying migration to
   * the insert path alone left their data orphaned forever (their next
   * login would skip migration because `findBySub` finds the existing
   * record). With migration on every login, those users self-heal on their
   * next sign-in.
   *
   * Migration failures must not block login: caught and logged.
   */
  async upsertBySub(sub: string, email: string | null = null): Promise<User> {
    const existing = await this.repository.findBySub(sub);
    let user: User;
    if (existing) {
      user = existing;
    } else {
      const created = User.create({ sub, hasCompletedOnboarding: false });
      if (!created.ok) throw created.error;
      await this.repository.save(created.value);
      user = created.value;
    }
    try {
      await this.legacyMigration.migrateIfLegacy(sub, email);
    } catch (err) {
      this.logger.warn(
        `Legacy migration failed for sub=${sub} email=${email}: ${(err as Error).message}`,
      );
    }
    return user;
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
