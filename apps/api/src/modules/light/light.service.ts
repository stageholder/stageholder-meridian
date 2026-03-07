import { Injectable } from '@nestjs/common';
import { format, subDays } from 'date-fns';
import { UserLightRepository } from './repository/user-light.repository';
import { LightEventRepository } from './repository/light-event.repository';
import { HabitRepository } from '../habit/habit.repository';
import { UserLight } from './domain/user-light.entity';
import { LightEvent, LightAction } from './domain/light-event.entity';
import {
  LIGHT_ACTIONS,
  RING_STREAK_MILESTONES,
  getMultiplier,
  getTodoLight,
} from './domain/light-config';

@Injectable()
export class LightService {
  constructor(
    private readonly userLightRepo: UserLightRepository,
    private readonly lightEventRepo: LightEventRepository,
    private readonly habitRepo: HabitRepository,
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

  async awardTodoComplete(
    userId: string,
    workspaceId: string,
    todoId: string,
    priority: string,
  ): Promise<void> {
    const date = this.getToday();
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      'todo_complete',
      date,
      todoId,
    );
    if (exists) return;

    const baseLight = getTodoLight(priority);
    await this.awardLight(userId, workspaceId, 'todo_complete', baseLight, date, {
      entityId: todoId,
      priority,
    });
  }

  async awardHabitCheckin(
    userId: string,
    workspaceId: string,
    habitId: string,
    entryId: string,
  ): Promise<void> {
    const date = this.getToday();
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      'habit_checkin',
      date,
      entryId,
    );
    if (exists) return;

    await this.awardLight(userId, workspaceId, 'habit_checkin', LIGHT_ACTIONS.HABIT_CHECKIN, date, {
      entityId: entryId,
      habitId,
    });
  }

  async awardJournalEntry(
    userId: string,
    workspaceId: string,
    journalId: string,
  ): Promise<void> {
    const date = this.getToday();
    const exists = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      'journal_entry',
      date,
      journalId,
    );
    if (exists) return;

    await this.awardLight(userId, workspaceId, 'journal_entry', LIGHT_ACTIONS.JOURNAL_ENTRY, date, {
      entityId: journalId,
    });
  }

  async evaluateDay(
    userId: string,
    workspaceId: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
    dateOverride?: string,
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userId);
    await this.evaluateDayForEntity(userLight, userId, workspaceId, rings, dateOverride);
  }

  private async evaluateDayForEntity(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
    dateOverride?: string,
  ): Promise<void> {
    const date = dateOverride ?? this.getToday();
    const previousDay = format(subDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd');
    const isConsecutive = userLight.lastActiveDate === previousDay;

    const todoRingStreak = rings.todo ? (isConsecutive ? userLight.todoRingStreak + 1 : 1) : 0;
    const habitRingStreak = rings.habit ? (isConsecutive ? userLight.habitRingStreak + 1 : 1) : 0;
    const journalRingStreak = rings.journal ? (isConsecutive ? userLight.journalRingStreak + 1 : 1) : 0;

    const isPerfectDay = rings.todo && rings.habit && rings.journal;
    const perfectDayStreak = isPerfectDay ? (isConsecutive ? userLight.perfectDayStreak + 1 : 1) : 0;

    userLight.updateStreaks({
      perfectDayStreak,
      todoRingStreak,
      habitRingStreak,
      journalRingStreak,
      lastActiveDate: date,
    });

    if (isPerfectDay) {
      userLight.incrementPerfectDays();

      const multiplier = getMultiplier(perfectDayStreak);
      const totalLight = Math.round(LIGHT_ACTIONS.PERFECT_DAY * multiplier);
      const eventResult = LightEvent.create({
        userId,
        workspaceId,
        action: 'perfect_day',
        baseLight: LIGHT_ACTIONS.PERFECT_DAY,
        multiplier,
        totalLight,
        date,
        metadata: { perfectDayStreak },
      });
      if (eventResult.ok) {
        await this.lightEventRepo.save(eventResult.value);
        userLight.addLight(totalLight);
      }
    }

    await this.checkStreakMilestones(userLight, userId, workspaceId, date, 'todo', todoRingStreak);
    await this.checkStreakMilestones(userLight, userId, workspaceId, date, 'habit', habitRingStreak);
    await this.checkStreakMilestones(userLight, userId, workspaceId, date, 'journal', journalRingStreak);

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
        const eventResult = LightEvent.create({
          userId,
          workspaceId,
          action: 'ring_streak_bonus',
          baseLight: milestone.bonus,
          multiplier: 1,
          totalLight: milestone.bonus,
          date,
          metadata: { ring, streak: milestone.days },
        });
        if (eventResult.ok) {
          await this.lightEventRepo.save(eventResult.value);
          userLight.addLight(milestone.bonus);
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
    const userLight = await this.getOrCreateUserLight(userId);

    // Lazy evaluation: if this is a new day, evaluate the previous day first
    if (userLight.lastActiveDate && userLight.lastActiveDate !== date) {
      await this.evaluatePreviousDay(userLight, userId, workspaceId, userLight.lastActiveDate);
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
    userLight.addLight(totalLight);

    // Update streaks in real-time based on current day's ring completion
    const currentRings = await this.computeRingCompletion(userId, date);
    const previousDay = format(subDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd');
    const wasConsecutive = userLight.lastActiveDate === previousDay || userLight.lastActiveDate === date;

    userLight.updateStreaks({
      todoRingStreak: currentRings.todo ? (wasConsecutive ? Math.max(userLight.todoRingStreak, 1) : 1) : 0,
      habitRingStreak: currentRings.habit ? (wasConsecutive ? Math.max(userLight.habitRingStreak, 1) : 1) : 0,
      journalRingStreak: currentRings.journal ? (wasConsecutive ? Math.max(userLight.journalRingStreak, 1) : 1) : 0,
      perfectDayStreak: currentRings.todo && currentRings.habit && currentRings.journal
        ? (wasConsecutive ? Math.max(userLight.perfectDayStreak, 1) : 1)
        : userLight.perfectDayStreak,
      lastActiveDate: date,
    });

    await this.userLightRepo.save(userLight);
  }

  private async evaluatePreviousDay(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    previousDate: string,
  ): Promise<void> {
    const rings = await this.computeRingCompletion(userId, previousDate);
    await this.evaluateDayForEntity(userLight, userId, workspaceId, rings, previousDate);
  }

  private async computeRingCompletion(
    userId: string,
    date: string,
  ): Promise<{ todo: boolean; habit: boolean; journal: boolean }> {
    const [todoEvents, habitEvents, journalEvents, totalHabits] =
      await Promise.all([
        this.lightEventRepo.countByUserActionDate(userId, 'todo_complete', date),
        this.lightEventRepo.countByUserActionDate(userId, 'habit_checkin', date),
        this.lightEventRepo.countByUserActionDate(userId, 'journal_entry', date),
        this.habitRepo.countByCreator(userId),
      ]);

    return {
      todo: todoEvents > 0,
      // Habit ring complete if all habits checked in, or no habits exist
      habit: totalHabits === 0 || habitEvents >= totalHabits,
      journal: journalEvents > 0,
    };
  }

  // TODO: getToday() uses server UTC time. When user timezone plumbing is available,
  // accept an optional timezone parameter and compute the local date accordingly.
  private getToday(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }
}
