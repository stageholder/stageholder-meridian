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
    private readonly notificationService: NotificationService,
  ) {}

  async getOrCreateUserLight(userSub: string): Promise<UserLight> {
    return this.userLightRepo.getOrCreateByUserSub(userSub);
  }

  async getUserLight(userSub: string): Promise<UserLight> {
    return this.getOrCreateUserLight(userSub);
  }

  async getEvents(userSub: string, limit: number, offset: number) {
    return this.lightEventRepo.findByUser(userSub, limit, offset);
  }

  async getStats(userSub: string, clientToday?: string) {
    const todayStr =
      clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
        ? clientToday
        : new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00Z");
    const windowStartDate = new Date(today);
    windowStartDate.setUTCDate(windowStartDate.getUTCDate() - 13);
    const windowStart = windowStartDate.toISOString().slice(0, 10);

    const { window, baseline } = await this.lightEventRepo.getGrowthStats(
      userSub,
      windowStart,
    );

    const dayMap = new Map(window.map((d) => [d.date, d]));
    const days: Array<{ date: string; light: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = dayMap.get(dateStr);
      days.push({
        date: dateStr,
        light: day?.light ?? 0,
      });
    }

    return {
      baseline: { totalLight: baseline.light },
      days,
    };
  }

  async updateTargets(
    userSub: string,
    targets: { todoTargetDaily?: number; journalTargetDailyWords?: number },
  ): Promise<UserLight> {
    const userLight = await this.getOrCreateUserLight(userSub);
    userLight.updateTargets(targets);
    await this.userLightRepo.save(userLight);
    return userLight;
  }

  async awardTodoCreate(userSub: string, todoId: string): Promise<void> {
    const date = await this.getTodayForUser(userSub);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userSub,
      "todo_create",
      date,
      todoId,
    );
    if (exists) return;

    await this.awardLight(
      userSub,
      "todo_create",
      LIGHT_ACTIONS.TODO_CREATE,
      date,
      {
        entityId: todoId,
      },
    );
  }

  async awardTodoComplete(
    userSub: string,
    todoId: string,
    priority: string,
  ): Promise<void> {
    const date = await this.getTodayForUser(userSub);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userSub,
      "todo_complete",
      date,
      todoId,
    );
    if (exists) return;

    const baseLight = getTodoLight(priority);
    await this.awardLight(userSub, "todo_complete", baseLight, date, {
      entityId: todoId,
      priority,
    });
  }

  /**
   * Award check-in Light for a habit entry.
   *
   * Idempotency is keyed on `(habitId, entryDate)` — NOT the entry's UUID — so
   * deleting + recreating an entry for the same day never re-awards, and Light
   * is credited to the day the habit was actually done (`entryDate`), not the
   * server's "today". A same-day check-in flows through the full `awardLight`
   * path (drives today's ring/streak recompute); a back-dated entry is credited
   * flat, because the ring/streak state machine is forward-only and replaying a
   * past date through it would corrupt the streak baseline.
   */
  async awardHabitCheckin(
    userSub: string,
    habitId: string,
    entryDate: string,
  ): Promise<void> {
    const entityId = `habit_${habitId}_${entryDate}`;
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userSub,
      "habit_checkin",
      entryDate,
      entityId,
    );
    if (exists) return;

    const today = await this.getTodayForUser(userSub);
    const metadata = { entityId, habitId };
    if (entryDate === today) {
      await this.awardLight(
        userSub,
        "habit_checkin",
        LIGHT_ACTIONS.HABIT_CHECKIN,
        entryDate,
        metadata,
      );
    } else {
      await this.awardLightFlat(
        userSub,
        "habit_checkin",
        LIGHT_ACTIONS.HABIT_CHECKIN,
        entryDate,
        metadata,
      );
    }
  }

  async awardJournalEntry(userSub: string, journalId: string): Promise<void> {
    const date = await this.getTodayForUser(userSub);
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userSub,
      "journal_entry",
      date,
      journalId,
    );
    if (exists) return;

    await this.awardLight(
      userSub,
      "journal_entry",
      LIGHT_ACTIONS.JOURNAL_ENTRY,
      date,
      {
        entityId: journalId,
      },
    );
  }

  async evaluateDay(
    userSub: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
    dateOverride?: string,
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userSub);
    const date = dateOverride ?? (await this.getTodayForUser(userSub));
    await this.evaluateDayForEntity(userLight, userSub, rings, date);
  }

  // Purge every light record (user_lights + light_events) for the user. Used
  // by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const [events, user] = await Promise.all([
      this.lightEventRepo.deleteAllForUser(userSub),
      this.userLightRepo.deleteAllForUser(userSub),
    ]);
    return events + user;
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
    userSub: string,
    rings: {
      todo: boolean;
      habit: boolean;
      habitEarned?: boolean;
      journal: boolean;
    },
    date: string,
    mode: "finalize" | "recompute" = "finalize",
  ): Promise<void> {
    const previousDay = format(
      subDays(new Date(date + "T00:00:00"), 1),
      "yyyy-MM-dd",
    );

    // ALWAYS derive streaks from the finalizedStreaks snapshot — the stable
    // baseline from the last finalize call. This makes both finalize and
    // recompute idempotent: they always produce the same target from the
    // same baseline regardless of how many times they're called.
    // Fallback for new users or pre-migration data: base everything at 0.
    const base = userLight.finalizedStreaks
      ? {
          todo: userLight.finalizedStreaks.todo,
          habit: userLight.finalizedStreaks.habit,
          journal: userLight.finalizedStreaks.journal,
          perfect: userLight.finalizedStreaks.perfect,
          anchorDate: userLight.lastFinalizedDate,
        }
      : {
          todo: 0,
          habit: 0,
          journal: 0,
          perfect: 0,
          anchorDate: null as string | null,
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

    // Perfect Day requires the habit ring to be EARNED (>=1 real check-in),
    // not merely shown complete via all-skips.
    const habitEarned = rings.habitEarned ?? rings.habit;
    const isPerfectDay = rings.todo && habitEarned && rings.journal;
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
        userSub,
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
          userSub,
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
              userSub,
              "Tier Up!",
              `You've reached ${newTitle}!`,
            );
          }
        }
      }
    }

    await this.checkStreakMilestones(
      userLight,
      userSub,
      date,
      "todo",
      userLight.todoRingStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userSub,
      date,
      "habit",
      userLight.habitRingStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userSub,
      date,
      "journal",
      userLight.journalRingStreak,
    );

    await this.userLightRepo.save(userLight);
  }

  private async checkStreakMilestones(
    userLight: UserLight,
    userSub: string,
    date: string,
    ring: string,
    streak: number,
  ): Promise<void> {
    for (const milestone of RING_STREAK_MILESTONES) {
      if (streak === milestone.days) {
        const milestoneEntityId = `ring_streak_${ring}_${milestone.days}_${date}`;
        const alreadyAwarded = await this.lightEventRepo.existsForEntityOnDate(
          userSub,
          "ring_streak_bonus",
          date,
          milestoneEntityId,
        );
        if (alreadyAwarded) continue;

        const eventResult = LightEvent.create({
          userSub,
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
            userSub,
            "Streak Milestone!",
            `Your ${ring} ring hit a ${milestone.days}-day streak! +${milestone.bonus} light`,
          );
          if (tieredUp) {
            this.notifyAchievement(
              userSub,
              "Tier Up!",
              `You've reached ${newTitle}!`,
            );
          }
        }
      }
    }
  }

  private async awardLight(
    userSub: string,
    action: LightAction,
    baseLight: number,
    date: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    let userLight = await this.getOrCreateUserLight(userSub);

    // Lazy evaluation: if this is a new day, finalize the previous day first
    if (userLight.lastActiveDate && userLight.lastActiveDate !== date) {
      await this.evaluatePreviousDay(
        userLight,
        userSub,
        userLight.lastActiveDate,
      );
      // Reload so the recompute pass starts from saved state,
      // not from the in-memory object mutated by the finalize pass
      userLight = await this.getOrCreateUserLight(userSub);
    }

    const multiplier = getMultiplier(userLight.perfectDayStreak);
    const totalLight = Math.round(baseLight * multiplier);

    const eventResult = LightEvent.create({
      userSub,
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
        userSub,
        "Tier Up!",
        `You've reached ${newTitle}!`,
      );
    }

    // Recompute ring completion and update streaks in real-time
    const currentRings = await this.computeRingCompletion(
      userSub,
      date,
      userLight.todoTargetDaily,
    );
    await this.checkRingCompletionBonus(userLight, userSub, date, currentRings);
    // evaluateDayForEntity is the single source of truth for streaks — it saves userLight
    await this.evaluateDayForEntity(
      userLight,
      userSub,
      currentRings,
      date,
      "recompute",
    );
  }

  /**
   * Credit Light for a PAST date without touching the forward-only ring/streak
   * state machine. Records the event (base light, multiplier 1 — no perfect-day
   * multiplier for back-fill), adds it to the user's total with tier-up
   * detection, and persists — but does NOT run the previous-day finalize or the
   * real-time ring recompute (both assume `date` is "today"; replaying a past
   * day would rewind `lastActiveDate` and scramble streaks).
   */
  private async awardLightFlat(
    userSub: string,
    action: LightAction,
    baseLight: number,
    date: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userSub);
    const eventResult = LightEvent.create({
      userSub,
      action,
      baseLight,
      multiplier: 1,
      totalLight: baseLight,
      date,
      metadata,
    });
    if (!eventResult.ok) return;
    await this.lightEventRepo.save(eventResult.value);
    const { tieredUp, newTitle } = this.addLightAndDetectTierUp(
      userLight,
      baseLight,
    );
    await this.userLightRepo.save(userLight);
    if (tieredUp) {
      this.notifyAchievement(
        userSub,
        "Tier Up!",
        `You've reached ${newTitle}!`,
      );
    }
  }

  private async checkRingCompletionBonus(
    userLight: UserLight,
    userSub: string,
    date: string,
    currentRings: {
      todo: boolean;
      habit: boolean;
      habitEarned?: boolean;
      journal: boolean;
    },
  ): Promise<void> {
    // The habit bonus is gated on `habitEarned` (>=1 real check-in), not the
    // display `habit` flag — an all-skip ring shows complete but earns no bonus.
    const habitBonusEligible = currentRings.habitEarned ?? currentRings.habit;
    const ringChecks: { ring: string; complete: boolean }[] = [
      { ring: "todo", complete: currentRings.todo },
      { ring: "habit", complete: habitBonusEligible },
      { ring: "journal", complete: currentRings.journal },
    ];

    for (const { ring, complete } of ringChecks) {
      if (!complete) continue;

      const entityId = `ring_${ring}_${date}`;
      const exists = await this.lightEventRepo.existsForEntityOnDate(
        userSub,
        "ring_completion_bonus",
        date,
        entityId,
      );
      if (exists) continue;

      const eventResult = LightEvent.create({
        userSub,
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
            userSub,
            "Tier Up!",
            `You've reached ${newTitle}!`,
          );
        }
      }
    }

    // All rings bonus — habit component must be earned (>=1 real check-in).
    if (currentRings.todo && habitBonusEligible && currentRings.journal) {
      const allRingsEntityId = `ring_all_${date}`;
      const allRingsExists = await this.lightEventRepo.existsForEntityOnDate(
        userSub,
        "ring_completion_bonus",
        date,
        allRingsEntityId,
      );
      if (!allRingsExists) {
        const eventResult = LightEvent.create({
          userSub,
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
            userSub,
            "All Rings Complete!",
            `You completed all daily rings! +${RING_COMPLETION_BONUS.ALL_RINGS} bonus light`,
          );
          if (tieredUp) {
            this.notifyAchievement(
              userSub,
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
    userSub: string,
    previousDate: string,
  ): Promise<void> {
    const rings = await this.computeRingCompletion(
      userSub,
      previousDate,
      userLight.todoTargetDaily,
    );
    await this.evaluateDayForEntity(userLight, userSub, rings, previousDate);
  }

  private async computeRingCompletion(
    userSub: string,
    date: string,
    todoTarget?: number,
  ): Promise<{
    todo: boolean;
    habit: boolean;
    habitEarned: boolean;
    journal: boolean;
  }> {
    const [todoEvents, habitEvents, journalEvents, userHabitIds] =
      await Promise.all([
        this.lightEventRepo.countByUserActionDate(
          userSub,
          "todo_complete",
          date,
        ),
        this.lightEventRepo.countByUserActionDate(
          userSub,
          "habit_checkin",
          date,
        ),
        this.lightEventRepo.countByUserActionDate(
          userSub,
          "journal_entry",
          date,
        ),
        // Filter to habits that existed on the evaluated date so creating
        // a new habit today doesn't retroactively inflate yesterday's ring
        this.habitRepo.findIdsByUserBefore(userSub, date),
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

    // Habit ring shows "complete" when every habit is checked in OR skipped (a
    // skip is a legitimate rest, it doesn't break the ring). But the ring is
    // only "earned" — eligible for the completion bonus + Perfect Day — when
    // there was at least one real check-in (or the user has no habits at all,
    // in which case the ring is vacuously satisfied). This stops an all-skip
    // day from farming the ring bonus for zero effort.
    const habitComplete =
      totalHabits === 0 || habitEvents + skipCount >= totalHabits;
    const habitEarned =
      totalHabits === 0 || (habitComplete && habitEvents >= 1);

    return {
      todo: todoEvents >= effectiveTodoTarget,
      habit: habitComplete,
      habitEarned,
      journal: journalEvents > 0,
    };
  }

  // The OIDC `zoneinfo` standard claim is the long-term plan; until the
  // Hub emits it, server-side scheduling falls back to DEFAULT_TIMEZONE / UTC.
  // Per-user timezone is now sourced client-side from the SDK's `useProfile()`.
  private async getTodayForUser(_userSub: string): Promise<string> {
    return this.getToday();
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
    recipientSub: string,
    title: string,
    message: string,
  ): void {
    this.notificationService
      .create({
        userSub: recipientSub,
        type: "achievement",
        title,
        message,
      })
      .catch((err) =>
        this.logger.warn(`Failed to create notification: ${err.message}`),
      );
  }
}
