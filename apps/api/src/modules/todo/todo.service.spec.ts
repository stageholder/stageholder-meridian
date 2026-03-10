import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TodoService } from './todo.service';
import { Todo } from './todo.entity';

const mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),
  findByList: vi.fn(),
  findByWorkspacePaginated: vi.fn(),
  countByList: vi.fn(),
  delete: vi.fn(),
};

const mockMemberService = {
  requireRole: vi.fn(),
  isMember: vi.fn(),
};

const mockLightService = {
  awardTodoComplete: vi.fn(),
  awardTodoCreate: vi.fn(),
};

function makeTodo(overrides: Partial<Record<string, unknown>> = {}) {
  const result = Todo.create({
    title: overrides.title as string ?? 'Test Todo',
    description: 'desc',
    status: 'todo',
    priority: 'medium',
    listId: 'list-1',
    workspaceId: overrides.workspaceId as string ?? 'ws-1',
    creatorId: 'user-1',
    order: 0,
  });
  if (!result.ok) throw new Error('Failed to create test todo');
  return result.value;
}

describe('TodoService', () => {
  let service: TodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemberService.requireRole.mockResolvedValue(undefined);
    mockMemberService.isMember.mockResolvedValue(true);
    mockLightService.awardTodoComplete.mockResolvedValue(undefined);
    mockLightService.awardTodoCreate.mockResolvedValue(undefined);
    service = new TodoService(
      mockRepository as any,
      mockMemberService as any,
      mockLightService as any,
    );
  });

  describe('create', () => {
    it('should create a todo and save it', async () => {
      mockRepository.countByList.mockResolvedValue(0);
      mockRepository.save.mockResolvedValue(undefined);

      const todo = await service.create('ws-1', 'user-1', {
        title: 'New Todo',
        listId: 'list-1',
      } as any);

      expect(todo.title).toBe('New Todo');
      expect(todo.workspaceId).toBe('ws-1');
      expect(todo.creatorId).toBe('user-1');
      expect(mockMemberService.requireRole).toHaveBeenCalledWith('ws-1', 'user-1', ['owner', 'admin', 'member']);
      expect(mockRepository.save).toHaveBeenCalledOnce();
      expect(mockLightService.awardTodoCreate).toHaveBeenCalledWith('user-1', 'ws-1', todo.id);
    });

    it('should reject assignee who is not a workspace member', async () => {
      mockRepository.countByList.mockResolvedValue(0);
      mockMemberService.isMember.mockResolvedValue(false);

      await expect(
        service.create('ws-1', 'user-1', {
          title: 'Todo',
          listId: 'list-1',
          assigneeId: 'non-member',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set the order based on existing items in the list', async () => {
      mockRepository.countByList.mockResolvedValue(5);
      mockRepository.save.mockResolvedValue(undefined);

      const todo = await service.create('ws-1', 'user-1', {
        title: 'Ordered Todo',
        listId: 'list-1',
      } as any);

      expect(todo.order).toBe(5);
    });
  });

  describe('findById', () => {
    it('should return a todo when found in the correct workspace', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);

      const result = await service.findById(todo.id, 'ws-1', 'user-1');
      expect(result.id).toBe(todo.id);
    });

    it('should throw NotFoundException when todo does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing', 'ws-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when todo belongs to a different workspace', async () => {
      const todo = makeTodo({ workspaceId: 'ws-other' });
      mockRepository.findById.mockResolvedValue(todo);

      await expect(service.findById(todo.id, 'ws-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update todo fields and save', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);
      mockRepository.save.mockResolvedValue(undefined);

      const updated = await service.update(todo.id, 'ws-1', 'user-1', {
        title: 'Updated Title',
        priority: 'high',
      } as any);

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
      expect(mockRepository.save).toHaveBeenCalledOnce();
    });

    it('should award light when status changes to done', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);
      mockRepository.save.mockResolvedValue(undefined);

      await service.update(todo.id, 'ws-1', 'user-1', { status: 'done' } as any);

      expect(mockLightService.awardTodoComplete).toHaveBeenCalledWith(
        'user-1', 'ws-1', todo.id, 'medium',
      );
    });

    it('should not award light when status is not done', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);
      mockRepository.save.mockResolvedValue(undefined);

      await service.update(todo.id, 'ws-1', 'user-1', { title: 'Renamed' } as any);

      expect(mockLightService.awardTodoComplete).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a todo after verifying access', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(todo.id, 'ws-1', 'user-1');

      expect(mockRepository.delete).toHaveBeenCalledWith(todo.id);
    });
  });

  describe('reorder', () => {
    it('should update order for each item in the workspace', async () => {
      const todo1 = makeTodo();
      const todo2 = makeTodo();
      mockRepository.findById
        .mockResolvedValueOnce(todo1)
        .mockResolvedValueOnce(todo2);
      mockRepository.save.mockResolvedValue(undefined);

      await service.reorder('ws-1', 'user-1', {
        items: [
          { id: todo1.id, order: 1 },
          { id: todo2.id, order: 0 },
        ],
      });

      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should skip items that do not belong to the workspace', async () => {
      const foreignTodo = makeTodo({ workspaceId: 'ws-other' });
      mockRepository.findById.mockResolvedValue(foreignTodo);
      mockRepository.save.mockResolvedValue(undefined);

      await service.reorder('ws-1', 'user-1', {
        items: [{ id: foreignTodo.id, order: 0 }],
      });

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('addSubtask', () => {
    it('should add a subtask and save', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.addSubtask(todo.id, 'ws-1', 'user-1', { title: 'Sub 1' } as any);

      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].title).toBe('Sub 1');
      expect(mockRepository.save).toHaveBeenCalledOnce();
    });
  });

  describe('removeSubtask', () => {
    it('should throw NotFoundException for a non-existent subtask', async () => {
      const todo = makeTodo();
      mockRepository.findById.mockResolvedValue(todo);

      await expect(
        service.removeSubtask(todo.id, 'non-existent-subtask', 'ws-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
