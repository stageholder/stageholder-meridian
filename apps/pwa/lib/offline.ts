import { db } from "@repo/offline/db";
import { fullSync } from "@repo/offline/sync/sync-manager";
import { sendNativeNotification } from "@repo/core/platform/notifications";
import { createTodosApi } from "@repo/core/api/todos";
import { createJournalsApi } from "@repo/core/api/journals";
import { createHabitsApi } from "@repo/core/api/habits";
import { createTagsApi } from "@repo/core/api/tags";
import { createNotificationsApi } from "@repo/core/api/notifications";
import { createWorkspacesApi } from "@repo/core/api/workspaces";
import apiClient, { getWorkspaceId } from "@/lib/api-client";

const todosApi = createTodosApi(apiClient, getWorkspaceId);
const journalsApi = createJournalsApi(apiClient, getWorkspaceId);
const habitsApi = createHabitsApi(apiClient, getWorkspaceId);
const tagsApi = createTagsApi(apiClient, getWorkspaceId);
const notificationsApi = createNotificationsApi(apiClient);
const workspacesApi = createWorkspacesApi(apiClient);

export async function syncAll(): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return;

  const fetchers = {
    workspaces: () => workspacesApi.list(),
    members: () => workspacesApi.listMembers(workspaceId),
    todoLists: () => todosApi.listLists(),
    todos: async () => {
      const lists = await todosApi.listLists();
      const allTodos = await Promise.all(
        lists.map((list) => todosApi.listTodos(list.id)),
      );
      return allTodos.flat();
    },
    journals: () => journalsApi.list(),
    habits: () => habitsApi.list(),
    habitEntries: async () => {
      const habits = await habitsApi.list();
      const allEntries = await Promise.all(
        habits.map((habit) => habitsApi.listEntries(habit.id)),
      );
      return allEntries.flat();
    },
    tags: () => tagsApi.list(),
    notifications: async () => {
      const result = await notificationsApi.list({ limit: 100 });
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
    await fullSync(
      workspaceId,
      apiClient,
      fetchers as Record<string, () => Promise<{ id: string }[]>>,
      tables as Record<string, (typeof tables)[keyof typeof tables]>,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendNativeNotification("Sync failed", message);
    throw error;
  }
}
