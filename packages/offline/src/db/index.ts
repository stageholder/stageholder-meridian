import Dexie, { type EntityTable, type Table } from "dexie";
import type {
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
  /**
   * OIDC `sub` of the user who created this mutation. Used to scope the
   * queue per-account so switching users never leaks writes across subs.
   */
  userSub: string;
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
  userSub: string;
  lastSyncedAt: string;
}

/**
 * Cached entitlement (plan + feature limits) for a given user. Refreshed
 * from the API on sync; read by the PWA to render the paywall offline.
 * The server remains authoritative for write-side enforcement.
 */
export interface EntitlementCache {
  userSub: string;
  plan: "meridian-free" | "meridian-unlimited" | string;
  entitled: boolean;
  limits: {
    max_habits: number;
    max_todo_lists: number;
    max_active_todos: number;
  };
  updatedAt: number;
}

/**
 * Cached journal-security material (wrapped DEK + salt) so the client can
 * unlock encrypted journals while offline. Kept in sync with the API's
 * `/journal-security/keys` response.
 */
export interface JournalSecurityCache {
  userSub: string;
  passphraseWrappedDek: string;
  passphraseSalt: string;
  updatedAt: number;
}

class MeridianDB extends Dexie {
  todoLists!: EntityTable<TodoList, "id">;
  todos!: EntityTable<Todo, "id">;
  journals!: EntityTable<Journal, "id">;
  habits!: EntityTable<Habit, "id">;
  habitEntries!: EntityTable<HabitEntry, "id">;
  tags!: EntityTable<Tag, "id">;
  notifications!: EntityTable<AppNotification, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;
  syncMeta!: Table<SyncMeta, [string, string]>;
  entitlementCache!: Table<EntitlementCache, string>;
  journalSecurityCache!: Table<JournalSecurityCache, string>;

  constructor() {
    super("meridian");

    this.version(1).stores({
      workspaces: "id, ownerId",
      members: "id, workspaceId, userId",
      todoLists: "id, workspaceId, isDefault",
      todos: "id, workspaceId, listId, status, dueDate",
      journals: "id, workspaceId, date",
      habits: "id, workspaceId",
      habitEntries: "id, habitId, workspaceId, date, [habitId+date]",
      tags: "id, workspaceId",
      notifications: "id, workspaceId, recipientId, read",
      pendingMutations: "++id, entityType, status, timestamp",
      syncMeta: "[entityType+workspaceId]",
    });

    this.version(2).stores({
      todos: "id, workspaceId, listId, status, dueDate, doDate",
    });

    // Version 3: Add tempId to pendingMutations (no index change needed)
    this.version(3).stores({});

    // Version 4: HabitEntry gains targetCountSnapshot and scheduledDaysSnapshot (no index needed)
    this.version(4).stores({});

    // Version 5: Hub integration — drop workspaces/members/invitations,
    // reindex every entity by `userSub`, and add entitlement +
    // journal-security caches.
    this.version(5).stores({
      workspaces: null,
      members: null,
      invitations: null,
      todoLists: "id, userSub, isDefault",
      todos: "id, userSub, listId, status, [userSub+dueDate], [userSub+doDate]",
      journals: "id, userSub, date",
      habits: "id, userSub",
      habitEntries: "id, habitId, userSub, date, [habitId+date]",
      tags: "id, userSub",
      notifications: "id, userSub, read",
      pendingMutations: "++id, userSub, entityType, status, timestamp",
      syncMeta: "[entityType+userSub]",
      entitlementCache: "userSub",
      journalSecurityCache: "userSub",
    });
  }
}

export const db = new MeridianDB();

/**
 * Wipe all user data from IndexedDB.
 * Must be called on logout to prevent data leakage between accounts.
 */
export async function clearAllUserData(): Promise<void> {
  await Promise.all([
    db.todoLists.clear(),
    db.todos.clear(),
    db.journals.clear(),
    db.habits.clear(),
    db.habitEntries.clear(),
    db.tags.clear(),
    db.notifications.clear(),
    db.pendingMutations.clear(),
    db.syncMeta.clear(),
    db.entitlementCache.clear(),
    db.journalSecurityCache.clear(),
  ]);
}

export function getTableForEntity(entityType: string) {
  const map: Record<string, EntityTable<any, any>> = {
    habits: db.habits,
    habitEntries: db.habitEntries,
    todos: db.todos,
    todoLists: db.todoLists,
    journals: db.journals,
    tags: db.tags,
    notifications: db.notifications,
  };
  const table = map[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);
  return table;
}
