import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Workspace,
  WorkspaceMember,
} from '@repo/core/types';

export interface TodoList {
  id: string;
  workspaceId: string;
  name: string;
  color?: string;
  icon?: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assigneeId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Journal {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  targetCount: number;
  unit?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  workspaceId: string;
  date: string;
  value: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  workspaceId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

export interface PendingMutation {
  id?: number;
  timestamp: number;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  path: string;
  payload: unknown;
  retryCount: number;
  status: 'pending' | 'in-flight' | 'failed';
}

export interface SyncMeta {
  entityType: string;
  workspaceId: string;
  lastSyncedAt: string;
}

class MeridianDB extends Dexie {
  workspaces!: EntityTable<Workspace, 'id'>;
  members!: EntityTable<WorkspaceMember, 'id'>;
  todoLists!: EntityTable<TodoList, 'id'>;
  todos!: EntityTable<Todo, 'id'>;
  journals!: EntityTable<Journal, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitEntries!: EntityTable<HabitEntry, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  notifications!: EntityTable<AppNotification, 'id'>;
  pendingMutations!: EntityTable<PendingMutation, 'id'>;
  syncMeta!: Table<SyncMeta, [string, string]>;

  constructor() {
    super('meridian');

    this.version(1).stores({
      workspaces: 'id, ownerId',
      members: 'id, workspaceId, userId',
      todoLists: 'id, workspaceId',
      todos: 'id, workspaceId, listId, status, assigneeId, dueDate',
      journals: 'id, workspaceId, date',
      habits: 'id, workspaceId',
      habitEntries: 'id, habitId, workspaceId, date, [habitId+date]',
      tags: 'id, workspaceId',
      notifications: 'id, workspaceId, recipientId, read',
      pendingMutations: '++id, entityType, status, timestamp',
      syncMeta: '[entityType+workspaceId]',
    });
  }
}

export const db = new MeridianDB();
