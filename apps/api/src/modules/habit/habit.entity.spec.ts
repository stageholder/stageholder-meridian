import { describe, it, expect } from 'vitest';
import { Habit } from './habit.entity';

describe('Habit Entity', () => {
  const validProps = {
    name: 'Morning Exercise',
    description: '30 minutes of exercise',
    frequency: 'daily' as const,
    targetCount: 1,
    unit: 'sessions',
    color: '#FF5733',
    icon: 'dumbbell',
    workspaceId: 'ws-123',
    creatorId: 'user-123',
  };

  describe('create()', () => {
    it('should create a habit with valid props', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Morning Exercise');
        expect(result.value.description).toBe('30 minutes of exercise');
        expect(result.value.frequency).toBe('daily');
        expect(result.value.targetCount).toBe(1);
        expect(result.value.unit).toBe('sessions');
        expect(result.value.color).toBe('#FF5733');
        expect(result.value.icon).toBe('dumbbell');
        expect(result.value.workspaceId).toBe('ws-123');
        expect(result.value.creatorId).toBe('user-123');
        expect(result.value.id).toBeDefined();
      }
    });

    it('should create with minimal required props', () => {
      const result = Habit.create({
        name: 'Read',
        frequency: 'daily',
        targetCount: 1,
        workspaceId: 'ws-123',
        creatorId: 'user-123',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Read');
        expect(result.value.description).toBeUndefined();
        expect(result.value.unit).toBeUndefined();
        expect(result.value.color).toBeUndefined();
        expect(result.value.icon).toBeUndefined();
      }
    });

    it('should default frequency to daily when not provided', () => {
      const result = Habit.create({
        ...validProps,
        frequency: undefined as unknown as 'daily',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.frequency).toBe('daily');
      }
    });

    it('should fail with empty name', () => {
      const result = Habit.create({ ...validProps, name: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Habit name is required');
      }
    });

    it('should fail with whitespace-only name', () => {
      const result = Habit.create({ ...validProps, name: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Habit name is required');
      }
    });

    it('should fail with empty workspaceId', () => {
      const result = Habit.create({ ...validProps, workspaceId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Workspace is required');
      }
    });

    it('should fail with empty creatorId', () => {
      const result = Habit.create({ ...validProps, creatorId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Creator is required');
      }
    });

    it('should fail with targetCount of 0', () => {
      const result = Habit.create({ ...validProps, targetCount: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Target count must be at least 1');
      }
    });

    it('should fail with negative targetCount', () => {
      const result = Habit.create({ ...validProps, targetCount: -1 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Target count must be at least 1');
      }
    });

    it('should accept targetCount of 1 (minimum)', () => {
      const result = Habit.create({ ...validProps, targetCount: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.targetCount).toBe(1);
      }
    });

    it('should accept weekly frequency', () => {
      const result = Habit.create({ ...validProps, frequency: 'weekly' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.frequency).toBe('weekly');
      }
    });

    it('should accept custom frequency', () => {
      const result = Habit.create({ ...validProps, frequency: 'custom' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.frequency).toBe('custom');
      }
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute a habit with all props and id', () => {
      const id = 'existing-habit-id';
      const props = {
        ...validProps,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      const habit = Habit.reconstitute(props, id);
      expect(habit.id).toBe(id);
      expect(habit.name).toBe('Morning Exercise');
      expect(habit.description).toBe('30 minutes of exercise');
      expect(habit.frequency).toBe('daily');
      expect(habit.targetCount).toBe(1);
      expect(habit.createdAt).toEqual(new Date('2024-01-01'));
      expect(habit.updatedAt).toEqual(new Date('2024-01-02'));
    });
  });

  describe('toObject()', () => {
    it('should return all properties including base entity fields', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.name).toBe('Morning Exercise');
        expect(obj.description).toBe('30 minutes of exercise');
        expect(obj.frequency).toBe('daily');
        expect(obj.targetCount).toBe(1);
        expect(obj.unit).toBe('sessions');
        expect(obj.color).toBe('#FF5733');
        expect(obj.icon).toBe('dumbbell');
        expect(obj.workspaceId).toBe('ws-123');
        expect(obj.creatorId).toBe('user-123');
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe('Business methods', () => {
    it('should update name and touch updatedAt', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        const originalUpdatedAt = habit.updatedAt;
        habit.updateName('Evening Walk');
        expect(habit.name).toBe('Evening Walk');
        expect(habit.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }
    });

    it('should update description', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateDescription('Updated description');
        expect(habit.description).toBe('Updated description');
      }
    });

    it('should clear description with undefined', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateDescription(undefined);
        expect(habit.description).toBeUndefined();
      }
    });

    it('should update frequency', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateFrequency('weekly');
        expect(habit.frequency).toBe('weekly');
      }
    });

    it('should update targetCount', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateTargetCount(5);
        expect(habit.targetCount).toBe(5);
      }
    });

    it('should update unit', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateUnit('pages');
        expect(habit.unit).toBe('pages');
      }
    });

    it('should clear unit with undefined', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateUnit(undefined);
        expect(habit.unit).toBeUndefined();
      }
    });

    it('should update color', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateColor('#00FF00');
        expect(habit.color).toBe('#00FF00');
      }
    });

    it('should clear color with undefined', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateColor(undefined);
        expect(habit.color).toBeUndefined();
      }
    });

    it('should update icon', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateIcon('running');
        expect(habit.icon).toBe('running');
      }
    });

    it('should clear icon with undefined', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.updateIcon(undefined);
        expect(habit.icon).toBeUndefined();
      }
    });
  });

  describe('softDelete() and restore()', () => {
    it('should soft delete a habit', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        expect(habit.isDeleted).toBe(false);
        habit.softDelete();
        expect(habit.isDeleted).toBe(true);
        expect(habit.deletedAt).toBeInstanceOf(Date);
      }
    });

    it('should restore a soft-deleted habit', () => {
      const result = Habit.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const habit = result.value;
        habit.softDelete();
        expect(habit.isDeleted).toBe(true);
        habit.restore();
        expect(habit.isDeleted).toBe(false);
        expect(habit.deletedAt).toBeUndefined();
      }
    });
  });

  describe('equals()', () => {
    it('should return true for entities with the same id', () => {
      const id = 'same-id';
      const h1 = Habit.reconstitute(validProps, id);
      const h2 = Habit.reconstitute({ ...validProps, name: 'Different' }, id);
      expect(h1.equals(h2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const h1 = Habit.reconstitute(validProps, 'id-1');
      const h2 = Habit.reconstitute(validProps, 'id-2');
      expect(h1.equals(h2)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
      const habit = Habit.reconstitute(validProps, 'id-1');
      expect(habit.equals(undefined)).toBe(false);
    });
  });
});
