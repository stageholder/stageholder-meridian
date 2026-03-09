import { describe, it, expect } from 'vitest';
import { Todo } from './todo.entity';

describe('Todo Entity', () => {
  const validProps = {
    title: 'Buy groceries',
    description: 'Milk, eggs, bread',
    status: 'todo' as const,
    priority: 'medium' as const,
    dueDate: '2024-12-31',
    listId: 'list-123',
    workspaceId: 'ws-123',
    assigneeId: 'user-456',
    creatorId: 'user-123',
    order: 1,
    subtasks: [],
  };

  describe('create()', () => {
    it('should create a todo with valid props', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe('Buy groceries');
        expect(result.value.description).toBe('Milk, eggs, bread');
        expect(result.value.status).toBe('todo');
        expect(result.value.priority).toBe('medium');
        expect(result.value.dueDate).toBe('2024-12-31');
        expect(result.value.listId).toBe('list-123');
        expect(result.value.workspaceId).toBe('ws-123');
        expect(result.value.assigneeId).toBe('user-456');
        expect(result.value.creatorId).toBe('user-123');
        expect(result.value.order).toBe(1);
        expect(result.value.id).toBeDefined();
      }
    });

    it('should default status to todo when not provided', () => {
      const result = Todo.create({
        ...validProps,
        status: undefined as unknown as 'todo',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('todo');
      }
    });

    it('should default priority to none when not provided', () => {
      const result = Todo.create({
        ...validProps,
        priority: undefined as unknown as 'none',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.priority).toBe('none');
      }
    });

    it('should default order to 0 when not provided', () => {
      const result = Todo.create({
        ...validProps,
        order: undefined as unknown as number,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.order).toBe(0);
      }
    });

    it('should fail with empty title', () => {
      const result = Todo.create({ ...validProps, title: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Todo title is required');
      }
    });

    it('should fail with whitespace-only title', () => {
      const result = Todo.create({ ...validProps, title: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Todo title is required');
      }
    });

    it('should fail with empty listId', () => {
      const result = Todo.create({ ...validProps, listId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('List is required');
      }
    });

    it('should fail with empty workspaceId', () => {
      const result = Todo.create({ ...validProps, workspaceId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Workspace is required');
      }
    });

    it('should fail with empty creatorId', () => {
      const result = Todo.create({ ...validProps, creatorId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Creator is required');
      }
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute a todo with all props and id', () => {
      const id = 'existing-todo-id';
      const props = {
        ...validProps,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      const todo = Todo.reconstitute(props, id);
      expect(todo.id).toBe(id);
      expect(todo.title).toBe('Buy groceries');
      expect(todo.status).toBe('todo');
      expect(todo.priority).toBe('medium');
      expect(todo.listId).toBe('list-123');
      expect(todo.workspaceId).toBe('ws-123');
      expect(todo.createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('toObject()', () => {
    it('should return all properties including base entity fields', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.title).toBe('Buy groceries');
        expect(obj.description).toBe('Milk, eggs, bread');
        expect(obj.status).toBe('todo');
        expect(obj.priority).toBe('medium');
        expect(obj.dueDate).toBe('2024-12-31');
        expect(obj.listId).toBe('list-123');
        expect(obj.workspaceId).toBe('ws-123');
        expect(obj.assigneeId).toBe('user-456');
        expect(obj.creatorId).toBe('user-123');
        expect(obj.order).toBe(1);
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe('Business methods', () => {
    it('should update title and touch updatedAt', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        const originalUpdatedAt = todo.updatedAt;
        todo.updateTitle('Updated title');
        expect(todo.title).toBe('Updated title');
        expect(todo.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }
    });

    it('should update description', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateDescription('New description');
        expect(todo.description).toBe('New description');
      }
    });

    it('should clear description with undefined', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateDescription(undefined);
        expect(todo.description).toBeUndefined();
      }
    });

    it('should update status', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateStatus('done');
        expect(todo.status).toBe('done');
      }
    });

    it('should update priority', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updatePriority('urgent');
        expect(todo.priority).toBe('urgent');
      }
    });

    it('should update due date', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateDueDate('2025-06-15');
        expect(todo.dueDate).toBe('2025-06-15');
      }
    });

    it('should update assignee', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateAssigneeId('new-user-789');
        expect(todo.assigneeId).toBe('new-user-789');
      }
    });

    it('should clear assignee with undefined', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateAssigneeId(undefined);
        expect(todo.assigneeId).toBeUndefined();
      }
    });

    it('should update order', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.updateOrder(5);
        expect(todo.order).toBe(5);
      }
    });
  });

  describe('softDelete() and restore()', () => {
    it('should soft delete a todo', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        expect(todo.isDeleted).toBe(false);
        todo.softDelete();
        expect(todo.isDeleted).toBe(true);
        expect(todo.deletedAt).toBeInstanceOf(Date);
      }
    });

    it('should restore a soft-deleted todo', () => {
      const result = Todo.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const todo = result.value;
        todo.softDelete();
        expect(todo.isDeleted).toBe(true);
        todo.restore();
        expect(todo.isDeleted).toBe(false);
        expect(todo.deletedAt).toBeUndefined();
      }
    });
  });

  describe('equals()', () => {
    it('should return true for entities with the same id', () => {
      const id = 'same-id';
      const todo1 = Todo.reconstitute(validProps, id);
      const todo2 = Todo.reconstitute({ ...validProps, title: 'Different' }, id);
      expect(todo1.equals(todo2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const todo1 = Todo.reconstitute(validProps, 'id-1');
      const todo2 = Todo.reconstitute(validProps, 'id-2');
      expect(todo1.equals(todo2)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
      const todo = Todo.reconstitute(validProps, 'id-1');
      expect(todo.equals(undefined)).toBe(false);
    });
  });
});
