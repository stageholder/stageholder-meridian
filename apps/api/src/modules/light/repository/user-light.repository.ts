import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserLightModel, UserLightDocument } from "../user-light.schema";
import { UserLight } from "../domain/user-light.entity";

@Injectable()
export class UserLightRepository {
  constructor(
    @InjectModel(UserLightModel.name) private model: Model<UserLightDocument>,
  ) {}

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
