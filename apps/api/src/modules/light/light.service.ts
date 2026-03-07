import { Injectable } from '@nestjs/common';
import { format, subDays } from 'date-fns';
import { UserLightRepository } from './repository/user-light.repository';
import { LightEventRepository } from './repository/light-event.repository';
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
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userId);
    const date = this.getToday();
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const isConsecutive = userLight.lastActiveDate === yesterday;

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
    await this.userLightRepo.save(userLight);
  }

  private getToday(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }
}
