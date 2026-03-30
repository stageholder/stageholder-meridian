import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { format, subDays } from "date-fns";
import { UserLightRepository } from "./repository/user-light.repository";
import { LightEventRepository } from "./repository/light-event.repository";
import { HabitRepository } from "../habit/habit.repository";
import {
  HabitEntryModel,
  HabitEntryDocument,
} from "../habit-entry/habit-entry.schema";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
import { UserLight } from "./domain/user-light.entity";
import { LightEvent, LightAction } from "./domain/light-event.entity";
import {
  LIGHT_ACTIONS,
  RING_STREAK_MILESTONES,
  RING_COMPLETION_BONUS,
  DEFAULT_TARGETS,
  getMultiplier,
  getTodoLight,
} from "./domain/light-config";

@Injectable()
export class LightService {
  private readonly logger = new Logger(LightService.name);

  constructor(
    private readonly userLightRepo: UserLightRepository,
    private readonly lightEventRepo: LightEventRepository,
    private readonly habitRepo: HabitRepository,
    @InjectModel(HabitEntryModel.name)
    private readonly habitEntryModel: Model<HabitEntryDocument>,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  async getOrCreateUserLight(userId: string): Promise<UserLight> {
    const existing = await this.userLightRepo.findByUserId(userId);
    if (existing) return existing;

    const result = UserLight.create(userId);
    if (!result.ok) throw result.error;
    await this.userLightRepo.save(result.value);
    return result.value;
  }

  async getUserLight(userId: string): Promise<UserLight> {
    return this.getOrCreateUserLight(userId);
  }

  async getEvents(userId: string, limit: number, offset: number) {
    return this.lightEventRepo.findByUser(userId, limit, offset);
  }

  async updateTargets(
    userId: string,
    targets: { todoTargetDaily?: number; journalTargetDailyWords?: number },
  ): Promise<UserLight> {
    const userLight = await this.getOrCreateUserLight(userId);
    userLight.updateTargets(targets);
    await this.userLightRepo.save(userLight);
    return userLight;
  }

  async awardTodoCreate(
    userId: string,
    workspaceId: string,
    todoId: string,
  ): Promise<void> {
    const date = await this.getTodayForUser(userId);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "todo_create",
      date,
      todoId,
    );
    if (exists) return;

    await this.awardLight(
      userId,
      workspaceId,
      "todo_create",
      LIGHT_ACTIONS.TODO_CREATE,
      date,
      {
        entityId: todoId,
      },
    );
  }

  async awardTodoComplete(
    userId: string,
    workspaceId: string,
    todoId: string,
    priority: string,
  ): Promise<void> {
    const date = await this.getTodayForUser(userId);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "todo_complete",
      date,
      todoId,
    );
    if (exists) return;

    const baseLight = getTodoLight(priority);
    await this.awardLight(
      userId,
      workspaceId,
      "todo_complete",
      baseLight,
      date,
      {
        entityId: todoId,
        priority,
      },
    );
  }

  async awardHabitCheckin(
    userId: string,
    workspaceId: string,
    habitId: string,
    entryId: string,
  ): Promise<void> {
    const date = await this.getTodayForUser(userId);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "habit_checkin",
      date,
      entryId,
    );
    if (exists) return;

    await this.awardLight(
      userId,
      workspaceId,
      "habit_checkin",
      LIGHT_ACTIONS.HABIT_CHECKIN,
      date,
      {
        entityId: entryId,
        habitId,
      },
    );
  }

  async awardJournalEntry(
    userId: string,
    workspaceId: string,
    journalId: string,
  ): Promise<void> {
    const date = await this.getTodayForUser(userId);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "journal_entry",
      date,
      journalId,
    );
    if (exists) return;

    await this.awardLight(
      userId,
      workspaceId,
      "journal_entry",
      LIGHT_ACTIONS.JOURNAL_ENTRY,
      date,
      {
        entityId: journalId,
      },
    );
  }

  async evaluateDay(
    userId: string,
    workspaceId: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
    dateOverride?: string,
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userId);
    const date = dateOverride ?? (await this.getTodayForUser(userId));
    await this.evaluateDayForEntity(
      userLight,
      userId,
      workspaceId,
      rings,
      date,
    );
  }

  /**
   * Single source of truth for streak calculation.
   *
   * @param mode
   *  - "finalize": day is over — incomplete rings reset streak to 0.
   *    Saves `lastFinalizedDate` and `finalizedStreaks` as a stable snapshot
   *    so subsequent recompute calls can derive idempotent target values.
   *  - "recompute": day still in progress — incomplete rings left unchanged (null).
   *    Derives streaks from `finalizedStreaks` (stable baseline that never changes
   *    during the day), making multiple calls per day fully idempotent.
   */
  private async evaluateDayForEntity(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
    date: string,
    mode: "finalize" | "recompute" = "finalize",
  ): Promise<void> {
    const previousDay = format(
      subDays(new Date(date + "T00:00:00"), 1),
      "yyyy-MM-dd",
    );

    // Use the finalized snapshot as a stable baseline in recompute mode.
    // In finalize mode, use the entity's current values directly.
    const base =
      mode === "recompute" && userLight.finalizedStreaks
        ? {
            todo: userLight.finalizedStreaks.todo,
            habit: userLight.finalizedStreaks.habit,
            journal: userLight.finalizedStreaks.journal,
            perfect: userLight.finalizedStreaks.perfect,
            anchorDate: userLight.lastFinalizedDate,
          }
        : {
            todo: userLight.todoRingStreak,
            habit: userLight.habitRingStreak,
            journal: userLight.journalRingStreak,
            perfect: userLight.perfectDayStreak,
            anchorDate: userLight.lastActiveDate,
          };

    const isConsecutive = base.anchorDate === previousDay;

    const computeStreak = (
      ringComplete: boolean,
      baseStreak: number,
    ): number | null => {
      if (ringComplete) {
        return isConsecutive ? baseStreak + 1 : 1;
      }
      return mode === "recompute" ? null : 0;
    };

    const todoRingStreak = computeStreak(rings.todo, base.todo);
    const habitRingStreak = computeStreak(rings.habit, base.habit);
    const journalRingStreak = computeStreak(rings.journal, base.journal);

    const isPerfectDay = rings.todo && rings.habit && rings.journal;
    const perfectDayStreak: number | null = isPerfectDay
      ? isConsecutive
        ? base.perfect + 1
        : 1
      : mode === "recompute"
        ? null
        : 0;

    userLight.updateStreaks({
      perfectDayStreak,
      todoRingStreak,
      habitRingStreak,
      journalRingStreak,
      lastActiveDate: date,
      // In finalize mode, snapshot the computed streaks as the stable baseline
      ...(mode === "finalize"
        ? {
            lastFinalizedDate: date,
            finalizedStreaks: {
              todo: todoRingStreak ?? 0,
              habit: habitRingStreak ?? 0,
              journal: journalRingStreak ?? 0,
              perfect: perfectDayStreak ?? 0,
            },
          }
        : {}),
    });

    if (isPerfectDay) {
      const perfectDayEntityId = `perfect_day_${date}`;
      const alreadyAwarded = await this.lightEventRepo.existsForEntityOnDate(
        userId,
        "perfect_day",
        date,
        perfectDayEntityId,
      );
      if (!alreadyAwarded) {
        userLight.incrementPerfectDays();
        const resolvedStreak = userLight.perfectDayStreak;
        const multiplier = getMultiplier(resolvedStreak);
        const totalLight = Math.round(LIGHT_ACTIONS.PERFECT_DAY * multiplier);
        const eventResult = LightEvent.create({
          userId,
          workspaceId,
          action: "perfect_day",
          baseLight: LIGHT_ACTIONS.PERFECT_DAY,
          multiplier,
          totalLight,
          date,
          metadata: {
            perfectDayStreak: resolvedStreak,
            entityId: perfectDayEntityId,
          },
        });
        if (eventResult.ok) {
          await this.lightEventRepo.save(eventResult.value);
          const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
            userLight,
            totalLight,
          );
          if (tieredUp) {
            this.notifyAchievement(
              userId,
              workspaceId,
              "Tier Up!",
              `You've reached ${newTitle}!`,
            );
          }
        }
      }
    }

    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      date,
      "todo",
      userLight.todoRingStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      date,
      "habit",
      userLight.habitRingStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      date,
      "journal",
      userLight.journalRingStreak,
    );

    await this.userLightRepo.save(userLight);
  }

  private async checkStreakMilestones(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    date: string,
    ring: string,
    streak: number,
  ): Promise<void> {
    for (const milestone of RING_STREAK_MILESTONES) {
      if (streak === milestone.days) {
        const milestoneEntityId = `ring_streak_${ring}_${milestone.days}_${date}`;
        const alreadyAwarded = await this.lightEventRepo.existsForEntityOnDate(
          userId,
          "ring_streak_bonus",
          date,
          milestoneEntityId,
        );
        if (alreadyAwarded) continue;

        const eventResult = LightEvent.create({
          userId,
          workspaceId,
          action: "ring_streak_bonus",
          baseLight: milestone.bonus,
          multiplier: 1,
          totalLight: milestone.bonus,
          date,
          metadata: {
            ring,
            streak: milestone.days,
            entityId: milestoneEntityId,
          },
        });
        if (eventResult.ok) {
          await this.lightEventRepo.save(eventResult.value);
          const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
            userLight,
            milestone.bonus,
          );
          this.notifyAchievement(
            userId,
            workspaceId,
            "Streak Milestone!",
            `Your ${ring} ring hit a ${milestone.days}-day streak! +${milestone.bonus} light`,
          );
          if (tieredUp) {
            this.notifyAchievement(
              userId,
              workspaceId,
              "Tier Up!",
              `You've reached ${newTitle}!`,
            );
          }
        }
      }
    }
  }

  private async awardLight(
    userId: string,
    workspaceId: string,
    action: LightAction,
    baseLight: number,
    date: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    let userLight = await this.getOrCreateUserLight(userId);

    // Lazy evaluation: if this is a new day, finalize the previous day first
    if (userLight.lastActiveDate && userLight.lastActiveDate !== date) {
      await this.evaluatePreviousDay(
        userLight,
        userId,
        workspaceId,
        userLight.lastActiveDate,
      );
      // Reload so the recompute pass starts from saved state,
      // not from the in-memory object mutated by the finalize pass
      userLight = await this.getOrCreateUserLight(userId);
    }

    const multiplier = getMultiplier(userLight.perfectDayStreak);
    const totalLight = Math.round(baseLight * multiplier);

    const eventResult = LightEvent.create({
      userId,
      workspaceId,
      action,
      baseLight,
      multiplier,
      totalLight,
      date,
      metadata,
    });
    if (!eventResult.ok) return;

    await this.lightEventRepo.save(eventResult.value);
    const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
      userLight,
      totalLight,
    );
    if (tieredUp) {
      this.notifyAchievement(
        userId,
        workspaceId,
        "Tier Up!",
        `You've reached ${newTitle}!`,
      );
    }

    // Recompute ring completion and update streaks in real-time
    const currentRings = await this.computeRingCompletion(
      workspaceId,
      userId,
      date,
      userLight.todoTargetDaily,
    );
    await this.checkRingCompletionBonus(
      userLight,
      userId,
      workspaceId,
      date,
      currentRings,
    );
    // evaluateDayForEntity is the single source of truth for streaks — it saves userLight
    await this.evaluateDayForEntity(
      userLight,
      userId,
      workspaceId,
      currentRings,
      date,
      "recompute",
    );
  }

  private async checkRingCompletionBonus(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    date: string,
    currentRings: { todo: boolean; habit: boolean; journal: boolean },
  ): Promise<void> {
    const ringChecks: { ring: string; complete: boolean }[] = [
      { ring: "todo", complete: currentRings.todo },
      { ring: "habit", complete: currentRings.habit },
      { ring: "journal", complete: currentRings.journal },
    ];

    for (const { ring, complete } of ringChecks) {
      if (!complete) continue;

      const entityId = `ring_${ring}_${date}`;
      const exists = await this.lightEventRepo.existsForEntityOnDate(
        userId,
        "ring_completion_bonus",
        date,
        entityId,
      );
      if (exists) continue;

      const eventResult = LightEvent.create({
        userId,
        workspaceId,
        action: "ring_completion_bonus",
        baseLight: RING_COMPLETION_BONUS.SINGLE_RING,
        multiplier: 1,
        totalLight: RING_COMPLETION_BONUS.SINGLE_RING,
        date,
        metadata: { entityId, ring },
      });
      if (eventResult.ok) {
        await this.lightEventRepo.save(eventResult.value);
        const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
          userLight,
          RING_COMPLETION_BONUS.SINGLE_RING,
        );
        if (tieredUp) {
          this.notifyAchievement(
            userId,
            workspaceId,
            "Tier Up!",
            `You've reached ${newTitle}!`,
          );
        }
      }
    }

    // All rings bonus
    if (currentRings.todo && currentRings.habit && currentRings.journal) {
      const allRingsEntityId = `ring_all_${date}`;
      const allRingsExists = await this.lightEventRepo.existsForEntityOnDate(
        userId,
        "ring_completion_bonus",
        date,
        allRingsEntityId,
      );
      if (!allRingsExists) {
        const eventResult = LightEvent.create({
          userId,
          workspaceId,
          action: "ring_completion_bonus",
          baseLight: RING_COMPLETION_BONUS.ALL_RINGS,
          multiplier: 1,
          totalLight: RING_COMPLETION_BONUS.ALL_RINGS,
          date,
          metadata: { entityId: allRingsEntityId, ring: "all" },
        });
        if (eventResult.ok) {
          await this.lightEventRepo.save(eventResult.value);
          const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
            userLight,
            RING_COMPLETION_BONUS.ALL_RINGS,
          );
          this.notifyAchievement(
            userId,
            workspaceId,
            "All Rings Complete!",
            `You completed all daily rings! +${RING_COMPLETION_BONUS.ALL_RINGS} bonus light`,
          );
          if (tieredUp) {
            this.notifyAchievement(
              userId,
              workspaceId,
              "Tier Up!",
              `You've reached ${newTitle}!`,
            );
          }
        }
      }
    }
  }

  private async evaluatePreviousDay(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    previousDate: string,
  ): Promise<void> {
    const rings = await this.computeRingCompletion(
      workspaceId,
      userId,
      previousDate,
      userLight.todoTargetDaily,
    );
    await this.evaluateDayForEntity(
      userLight,
      userId,
      workspaceId,
      rings,
      previousDate,
    );
  }

  private async computeRingCompletion(
    workspaceId: string,
    userId: string,
    date: string,
    todoTarget?: number,
  ): Promise<{ todo: boolean; habit: boolean; journal: boolean }> {
    const [todoEvents, habitEvents, journalEvents, userHabitIds] =
      await Promise.all([
        this.lightEventRepo.countByUserActionDate(
          userId,
          "todo_complete",
          date,
        ),
        this.lightEventRepo.countByUserActionDate(
          userId,
          "habit_checkin",
          date,
        ),
        this.lightEventRepo.countByUserActionDate(
          userId,
          "journal_entry",
          date,
        ),
        // Filter to habits that existed on the evaluated date so creating
        // a new habit today doesn't retroactively inflate yesterday's ring
        this.habitRepo.findIdsByWorkspaceCreatorBefore(
          workspaceId,
          userId,
          date,
        ),
      ]);

    const totalHabits = userHabitIds.length;
    // Only count skips for this user's habits
    const skipCount =
      totalHabits > 0
        ? await this.habitEntryModel.countDocuments({
            habit_id: { $in: userHabitIds },
            date,
            type: "skip",
            deleted_at: null,
          })
        : 0;

    const effectiveTodoTarget = todoTarget ?? DEFAULT_TARGETS.todoDaily;

    return {
      todo: todoEvents >= effectiveTodoTarget,
      // Habit ring complete if all habits checked in or skipped, or no habits exist
      habit: totalHabits === 0 || habitEvents + skipCount >= totalHabits,
      journal: journalEvents > 0,
    };
  }

  private async getTodayForUser(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    return this.getToday(user?.timezone);
  }

  private getToday(timezone?: string): string {
    const tz = timezone || process.env.DEFAULT_TIMEZONE || "UTC";
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      // Fall back to UTC if timezone is invalid
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    }
  }

  private addLightAndDetectTierUp(
    userLight: UserLight,
    amount: number,
  ): { tieredUp: boolean; newTitle: string } {
    const oldTier = userLight.currentTier;
    userLight.addLight(amount);
    return {
      tieredUp: userLight.currentTier > oldTier,
      newTitle: userLight.currentTitle,
    };
  }

  private notifyAchievement(
    recipientId: string,
    workspaceId: string,
    title: string,
    message: string,
  ): void {
    this.notificationService
      .create({ recipientId, workspaceId, type: "achievement", title, message })
      .catch((err) =>
        this.logger.warn(`Failed to create notification: ${err.message}`),
      );
  }
}
