import { db } from "@repo/offline/db";
import { fullSync, type SyncConflict } from "@repo/offline/sync/sync-manager";
import { sendNativeNotification } from "@repo/core/platform/notifications";
import { logger } from "@repo/core/platform/logger";
import { createTodosApi } from "@repo/core/api/todos";
import { createJournalsApi } from "@repo/core/api/journals";
import { createHabitsApi } from "@repo/core/api/habits";
import { createTagsApi } from "@repo/core/api/tags";
import { createNotificationsApi } from "@repo/core/api/notifications";
import { createWorkspacesApi } from "@repo/core/api/workspaces";
import apiClient, { getWorkspaceId } from "@/lib/api-client";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { decryptJournalList } from "@/lib/crypto/journal-crypto";
import { registerJournalEncryptionTransform } from "@/lib/crypto/register-transforms";

// Register encryption transform for offline journal mutations
registerJournalEncryptionTransform();

const todosApi = createTodosApi(apiClient, getWorkspaceId);
const journalsApi = createJournalsApi(apiClient, getWorkspaceId);
const habitsApi = createHabitsApi(apiClient, getWorkspaceId);
const tagsApi = createTagsApi(apiClient, getWorkspaceId);
const notificationsApi = createNotificationsApi(apiClient);
const workspacesApi = createWorkspacesApi(apiClient);

let onConflicts: ((conflicts: SyncConflict[]) => void) | null = null;

export function setConflictHandler(
  handler: (conflicts: SyncConflict[]) => void,
) {
  onConflicts = handler;
}

function buildParams(since?: string): Record<string, string> | undefined {
  if (!since) return undefined;
  return { updatedSince: since, includeSoftDeleted: "true" };
}

export async function syncAll(): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return;

  const fetchers = {
    workspaces: (since?: string) => workspacesApi.list(buildParams(since)),
    members: (since?: string) =>
      workspacesApi.listMembers(workspaceId, buildParams(since)),
    todoLists: (since?: string) => todosApi.listLists(buildParams(since)),
    todos: async (since?: string) => {
      if (since) {
        // Delta sync: fetch all updated todos directly
        return todosApi.listAllTodos({ ...buildParams(since), limit: 1000 });
      }
      const lists = await todosApi.listLists();
      const allTodos = await Promise.all(
        lists.map((list) => todosApi.listTodos(list.id)),
      );
      return allTodos.flat();
    },
    journals: async (since?: string) => {
      const { isSetup, isUnlocked, dek } = useEncryptionStore.getState();
      // Skip journal sync when encryption is set up but locked
      if (isSetup && !isUnlocked) return [];
      const journals = await journalsApi.list(buildParams(since));
      if (dek) return decryptJournalList(journals, dek);
      return journals;
    },
    habits: (since?: string) => habitsApi.list(buildParams(since)),
    habitEntries: async (since?: string) => {
      if (since) {
        return habitsApi.listAllEntries({ ...buildParams(since), limit: 1000 });
      }
      const habits = await habitsApi.list();
      const allEntries = await Promise.all(
        habits.map((habit) => habitsApi.listEntries(habit.id)),
      );
      return allEntries.flat();
    },
    tags: (since?: string) => tagsApi.list(buildParams(since)),
    notifications: async (since?: string) => {
      const result = await notificationsApi.list({
        limit: 100,
        ...buildParams(since),
      });
      return result.data;
    },
  };

  const tables = {
    workspaces: db.workspaces,
    members: db.members,
    todoLists: db.todoLists,
    todos: db.todos,
    journals: db.journals,
    habits: db.habits,
    habitEntries: db.habitEntries,
    tags: db.tags,
    notifications: db.notifications,
  };

  try {
    const conflicts = await fullSync(
      workspaceId,
      apiClient,
      fetchers as Record<string, (since?: string) => Promise<{ id: string }[]>>,
      tables as Record<string, (typeof tables)[keyof typeof tables]>,
    );

    if (conflicts.length > 0 && onConflicts) {
      onConflicts(conflicts);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    logger.error(`[Sync] Failed: ${message}\n${stack ?? ""}`);
    sendNativeNotification("Sync failed", message);
    throw error;
  }
}
