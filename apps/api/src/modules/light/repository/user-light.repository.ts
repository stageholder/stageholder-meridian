import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomUUID } from "crypto";
import { UserLightModel, UserLightDocument } from "../user-light.schema";
import { UserLight } from "../domain/user-light.entity";

@Injectable()
export class UserLightRepository implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserLightRepository.name);

  constructor(
    @InjectModel(UserLightModel.name) private model: Model<UserLightDocument>,
  ) {}

  // The pre-Hub schema declared `user_id` as a unique field; the current
  // schema scopes by `userSub` instead and does not write `user_id` on new
  // inserts. The legacy `user_id_1` unique index is still in production
  // Mongo, so the very first new row inserts as `user_id: null` and every
  // subsequent insert collides (E11000 dup key on null) — manifesting as a
  // 500 on `GET /light/me`. Drop the stale index once at boot. Idempotent:
  // IndexNotFound after the first deploy is swallowed silently.
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.model.collection.dropIndex("user_id_1");
      this.logger.log(
        "Dropped legacy user_id_1 index from user_lights collection",
      );
    } catch (err: any) {
      const code = err?.code ?? err?.codeName;
      if (code === 27 || code === "IndexNotFound") return;
      this.logger.warn(
        `Could not drop legacy user_id_1 index: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Atomic get-or-create keyed by `userSub`. The previous implementation did
   * a non-atomic find-then-save, which raced with parallel writers (e.g. JIT
   * legacy migration setting `userSub` on the legacy `user_lights` row at
   * the same moment a fresh login fires `/light/me`) and produced E11000 on
   * the `userSub` unique index. A single `findOneAndUpdate({userSub}, ...,
   * {upsert})` is guaranteed atomic by Mongo, so this codepath can no longer
   * collide regardless of what other writers do.
   */
  async getOrCreateByUserSub(userSub: string): Promise<UserLight> {
    const doc = await this.model
      .findOneAndUpdate(
        { userSub, deleted_at: null },
        {
          $setOnInsert: {
            _id: randomUUID(),
            userSub,
            total_light: 0,
            current_tier: 1,
            current_title: "Stargazer",
            perfect_day_streak: 0,
            todo_ring_streak: 0,
            habit_ring_streak: 0,
            journal_ring_streak: 0,
            last_active_date: null,
            last_finalized_date: null,
            finalized_streaks: null,
            longest_perfect_streak: 0,
            perfect_days_total: 0,
            todo_target_daily: 3,
            journal_target_daily_words: 75,
            deleted_at: null,
          },
        },
        { upsert: true, new: true },
      )
      .lean();
    if (!doc) {
      throw new Error(`Failed to upsert user_lights for userSub=${userSub}`);
    }
    return this.toDomain(doc);
  }

  async save(userLight: UserLight): Promise<void> {
    const data = userLight.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          userSub: data.userSub,
          total_light: data.totalLight,
          current_tier: data.currentTier,
          current_title: data.currentTitle,
          perfect_day_streak: data.perfectDayStreak,
          todo_ring_streak: data.todoRingStreak,
          habit_ring_streak: data.habitRingStreak,
          journal_ring_streak: data.journalRingStreak,
          last_active_date: data.lastActiveDate,
          last_finalized_date: data.lastFinalizedDate,
          finalized_streaks: data.finalizedStreaks,
          longest_perfect_streak: data.longestPerfectStreak,
          perfect_days_total: data.perfectDaysTotal,
          todo_target_daily: data.todoTargetDaily,
          journal_target_daily_words: data.journalTargetDailyWords,
        },
      },
      { upsert: true },
    );
  }

  async findByUserSub(userSub: string): Promise<UserLight | null> {
    const doc = await this.model.findOne({ userSub, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  // Hard-delete the user light record for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  private toDomain(doc: any): UserLight {
    return UserLight.reconstitute(
      {
        userSub: doc.userSub,
        totalLight: doc.total_light,
        currentTier: doc.current_tier,
        currentTitle: doc.current_title,
        perfectDayStreak: doc.perfect_day_streak,
        todoRingStreak: doc.todo_ring_streak,
        habitRingStreak: doc.habit_ring_streak,
        journalRingStreak: doc.journal_ring_streak,
        lastActiveDate: doc.last_active_date,
        lastFinalizedDate: doc.last_finalized_date ?? null,
        finalizedStreaks: doc.finalized_streaks ?? null,
        longestPerfectStreak: doc.longest_perfect_streak,
        perfectDaysTotal: doc.perfect_days_total,
        todoTargetDaily: doc.todo_target_daily ?? 3,
        journalTargetDailyWords: doc.journal_target_daily_words ?? 75,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
