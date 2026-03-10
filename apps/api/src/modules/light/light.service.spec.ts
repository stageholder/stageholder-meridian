import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LightService } from './light.service';
import { UserLight } from './domain/user-light.entity';
import { LIGHT_ACTIONS } from './domain/light-config';

function makeUserLight(overrides: Partial<Record<string, unknown>> = {}): UserLight {
  const result = UserLight.create('user-1');
  if (!result.ok) throw new Error('Failed to create UserLight');
  const ul = result.value;
  if (overrides.lastActiveDate !== undefined) ul.setLastActiveDate(overrides.lastActiveDate as string);
  if (overrides.totalLight) ul.addLight(overrides.totalLight as number);
  if (overrides.perfectDayStreak !== undefined || overrides.todoRingStreak !== undefined) {
    ul.updateStreaks({
      perfectDayStreak: (overrides.perfectDayStreak as number) ?? 0,
      todoRingStreak: (overrides.todoRingStreak as number) ?? 0,
      habitRingStreak: (overrides.habitRingStreak as number) ?? 0,
      journalRingStreak: (overrides.journalRingStreak as number) ?? 0,
      lastActiveDate: (overrides.lastActiveDate as string) ?? '2026-03-10',
    });
  }
  return ul;
}

const mockUserLightRepo = {
  findByUserId: vi.fn(),
  save: vi.fn(),
};

const mockLightEventRepo = {
  save: vi.fn(),
  findByUser: vi.fn(),
  existsForEntityOnDate: vi.fn(),
  countByUserActionDate: vi.fn(),
};

const mockHabitRepo = {
  countByCreator: vi.fn(),
};

const mockUserService = {
  findById: vi.fn(),
};

describe('LightService', () => {
  let service: LightService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserLightRepo.save.mockResolvedValue(undefined);
    mockLightEventRepo.save.mockResolvedValue(undefined);
    service = new LightService(
      mockUserLightRepo as any,
      mockLightEventRepo as any,
      mockHabitRepo as any,
      mockUserService as any,
    );
  });

  describe('getOrCreateUserLight', () => {
    it('should return existing UserLight if found', async () => {
      const existing = makeUserLight();
      mockUserLightRepo.findByUserId.mockResolvedValue(existing);

      const result = await service.getOrCreateUserLight('user-1');

      expect(result).toBe(existing);
      expect(mockUserLightRepo.save).not.toHaveBeenCalled();
    });

    it('should create and save a new UserLight if none exists', async () => {
      mockUserLightRepo.findByUserId.mockResolvedValue(null);

      const result = await service.getOrCreateUserLight('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.totalLight).toBe(0);
      expect(result.currentTier).toBe(1);
      expect(result.currentTitle).toBe('Stargazer');
      expect(mockUserLightRepo.save).toHaveBeenCalledOnce();
    });
  });

  describe('updateTargets', () => {
    it('should update todo target and save', async () => {
      const ul = makeUserLight();
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);

      const result = await service.updateTargets('user-1', { todoTargetDaily: 5 });

      expect(result.todoTargetDaily).toBe(5);
      expect(mockUserLightRepo.save).toHaveBeenCalledOnce();
    });

    it('should update journal word target', async () => {
      const ul = makeUserLight();
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);

      const result = await service.updateTargets('user-1', { journalTargetDailyWords: 300 });

      expect(result.journalTargetDailyWords).toBe(300);
    });
  });

  describe('awardTodoComplete', () => {
    it('should not award if already awarded for same entity on same date', async () => {
      mockUserService.findById.mockResolvedValue({ timezone: 'UTC' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(true);

      await service.awardTodoComplete('user-1', 'ws-1', 'todo-1', 'medium');

      expect(mockLightEventRepo.save).not.toHaveBeenCalled();
    });

    it('should create a light event when awarding for first time', async () => {
      const ul = makeUserLight();
      mockUserService.findById.mockResolvedValue({ timezone: 'UTC' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(false);
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);
      mockLightEventRepo.countByUserActionDate.mockResolvedValue(0);
      mockHabitRepo.countByCreator.mockResolvedValue(0);

      await service.awardTodoComplete('user-1', 'ws-1', 'todo-1', 'medium');

      expect(mockLightEventRepo.save).toHaveBeenCalled();
      expect(mockUserLightRepo.save).toHaveBeenCalled();
    });
  });

  describe('awardHabitCheckin', () => {
    it('should skip if already awarded for this entry today', async () => {
      mockUserService.findById.mockResolvedValue({ timezone: 'UTC' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(true);

      await service.awardHabitCheckin('user-1', 'ws-1', 'habit-1', 'entry-1');

      expect(mockLightEventRepo.save).not.toHaveBeenCalled();
    });

    it('should award light for a new habit checkin', async () => {
      const ul = makeUserLight();
      mockUserService.findById.mockResolvedValue({ timezone: 'UTC' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(false);
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);
      mockLightEventRepo.countByUserActionDate.mockResolvedValue(0);
      mockHabitRepo.countByCreator.mockResolvedValue(1);

      await service.awardHabitCheckin('user-1', 'ws-1', 'habit-1', 'entry-1');

      expect(mockLightEventRepo.save).toHaveBeenCalled();
    });
  });

  describe('awardJournalEntry', () => {
    it('should skip duplicate journal awards on the same date', async () => {
      mockUserService.findById.mockResolvedValue({ timezone: 'UTC' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(true);

      await service.awardJournalEntry('user-1', 'ws-1', 'journal-1');

      expect(mockLightEventRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('evaluateDay', () => {
    it('should update streaks for a perfect day', async () => {
      const ul = makeUserLight({ lastActiveDate: '2026-03-09' });
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);

      await service.evaluateDay('user-1', 'ws-1', {
        todo: true,
        habit: true,
        journal: true,
      }, '2026-03-10');

      expect(ul.perfectDayStreak).toBeGreaterThanOrEqual(1);
      expect(mockUserLightRepo.save).toHaveBeenCalled();
    });

    it('should reset streaks when rings are not complete', async () => {
      const ul = makeUserLight({
        lastActiveDate: '2026-03-09',
        perfectDayStreak: 5,
        todoRingStreak: 5,
      });
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);

      await service.evaluateDay('user-1', 'ws-1', {
        todo: false,
        habit: false,
        journal: false,
      }, '2026-03-10');

      expect(ul.todoRingStreak).toBe(0);
      expect(ul.perfectDayStreak).toBe(0);
    });

    it('should increment perfectDaysTotal on a perfect day', async () => {
      const ul = makeUserLight({ lastActiveDate: '2026-03-09' });
      mockUserLightRepo.findByUserId.mockResolvedValue(ul);

      const beforeTotal = ul.perfectDaysTotal;

      await service.evaluateDay('user-1', 'ws-1', {
        todo: true,
        habit: true,
        journal: true,
      }, '2026-03-10');

      expect(ul.perfectDaysTotal).toBe(beforeTotal + 1);
    });
  });

  describe('getEvents', () => {
    it('should forward to lightEventRepo.findByUser', async () => {
      const events = [{ id: 'ev-1' }];
      mockLightEventRepo.findByUser.mockResolvedValue(events);

      const result = await service.getEvents('user-1', 10, 0);

      expect(result).toBe(events);
      expect(mockLightEventRepo.findByUser).toHaveBeenCalledWith('user-1', 10, 0);
    });
  });

  describe('timezone handling', () => {
    it('should use user timezone for determining today', async () => {
      const ul = makeUserLight();
      mockUserService.findById.mockResolvedValue({ timezone: 'Asia/Jakarta' });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(true);

      await service.awardTodoComplete('user-1', 'ws-1', 'todo-1', 'low');

      // Should have called findById to get user timezone
      expect(mockUserService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should fall back to UTC when user has no timezone', async () => {
      mockUserService.findById.mockResolvedValue({ timezone: undefined });
      mockLightEventRepo.existsForEntityOnDate.mockResolvedValue(true);

      // Should not throw even with no timezone
      await expect(
        service.awardTodoComplete('user-1', 'ws-1', 'todo-1', 'low'),
      ).resolves.not.toThrow();
    });
  });
});
