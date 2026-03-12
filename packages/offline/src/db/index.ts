import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Workspace,
  WorkspaceMember,
  TodoList,
  Todo,
  Journal,
  Habit,
  HabitEntry,
  Tag,
  AppNotification,
} from "@repo/core/types";

export interface PendingMutation {
  id?: number;
  timestamp: number;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  path: string;
  payload: unknown;
  retryCount: number;
  status: "pending" | "in-flight" | "failed";
  tempId?: string;
}

export interface SyncMeta {
  entityType: string;
  workspaceId: string;
  lastSyncedAt: string;
}

class MeridianDB extends Dexie {
  workspaces!: EntityTable<Workspace, "id">;
  members!: EntityTable<WorkspaceMember, "id">;
  todoLists!: EntityTable<TodoList, "id">;
  todos!: EntityTable<Todo, "id">;
  journals!: EntityTable<Journal, "id">;
  habits!: EntityTable<Habit, "id">;
  habitEntries!: EntityTable<HabitEntry, "id">;
  tags!: EntityTable<Tag, "id">;
  notifications!: EntityTable<AppNotification, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;
  syncMeta!: Table<SyncMeta, [string, string]>;

  constructor() {
    super("meridian");

    this.version(1).stores({
      workspaces: "id, ownerId",
      members: "id, workspaceId, userId",
      todoLists: "id, workspaceId, isDefault",
      todos: "id, workspaceId, listId, status, assigneeId, dueDate",
      journals: "id, workspaceId, date",
      habits: "id, workspaceId",
      habitEntries: "id, habitId, workspaceId, date, [habitId+date]",
      tags: "id, workspaceId",
      notifications: "id, workspaceId, recipientId, read",
      pendingMutations: "++id, entityType, status, timestamp",
      syncMeta: "[entityType+workspaceId]",
    });

    this.version(2).stores({
      todos: "id, workspaceId, listId, status, assigneeId, dueDate, doDate",
    });

    // Version 3: Add tempId to pendingMutations (no index change needed)
    this.version(3).stores({});
  }
}

export const db = new MeridianDB();

export function getTableForEntity(entityType: string) {
  const map: Record<string, EntityTable<any, any>> = {
    habits: db.habits,
    habitEntries: db.habitEntries,
    todos: db.todos,
    todoLists: db.todoLists,
    journals: db.journals,
    tags: db.tags,
    notifications: db.notifications,
    workspaces: db.workspaces,
    members: db.members,
  };
  const table = map[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);
  return table;
}
