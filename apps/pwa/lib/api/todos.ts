import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { TodoList, Todo } from "@repo/core/types";
import {
  useOfflineQuery,
  useOfflineQuerySingle,
  useOfflineQueryFiltered,
  useOfflineMutation,
  useOfflineDeleteMutation,
} from "@repo/offline/hooks";
import { db } from "@repo/offline/db";
import { useNetworkStatus } from "@repo/offline/network";
import { lightKeys } from "./light";
import { useCallback } from "react";

export function useTodoLists() {
  const { workspace } = useWorkspace();

  return useOfflineQuery<TodoList>(
    ["todoLists", workspace.id],
    db.todoLists,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/todo-lists`);
      return res.data?.data ?? res.data;
    },
  );
}

export function useTodoList(listId: string) {
  const { workspace } = useWorkspace();

  return useOfflineQuerySingle<TodoList>(
    ["todoList", workspace.id, listId],
    db.todoLists,
    listId,
    async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/todo-lists/${listId}`,
      );
      return res.data;
    },
    { enabled: !!listId },
  );
}

export function useTodos(listId: string) {
  const { workspace } = useWorkspace();

  const localQueryFn = useCallback(
    () => db.todos.where("listId").equals(listId).toArray(),
    [listId],
  );

  return useOfflineQueryFiltered<Todo>(
    ["todos", workspace.id, listId],
    localQueryFn,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/todos`, {
        params: { listId },
      });
      return res.data;
    },
    db.todos,
    { enabled: !!listId },
  );
}

export function useAllTodos() {
  const { workspace } = useWorkspace();

  return useOfflineQuery<Todo>(
    ["allTodos", workspace.id],
    db.todos,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/todos`, {
        params: { limit: 500 },
      });
      return res.data?.data ?? res.data;
    },
  );
}

export function useCreateTodoList() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    TodoList,
    {
      name: string;
      color?: string;
      icon?: string;
      isShared?: boolean;
    }
  >({
    mutationFn: async (data) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/todo-lists`,
        data,
      );
      return res.data as TodoList;
    },
    table: db.todoLists,
    entityType: "todoLists",
    operation: "create",
    buildPath: () => `/workspaces/${workspace.id}/todo-lists`,
    invalidateKeys: [["todoLists", workspace.id]],
  });
}

export function useUpdateTodoList() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    TodoList,
    {
      listId: string;
      data: {
        name?: string;
        color?: string;
        icon?: string;
        isShared?: boolean;
      };
    }
  >({
    mutationFn: async ({ listId, data }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/todo-lists/${listId}`,
        data,
      );
      return res.data as TodoList;
    },
    table: db.todoLists,
    entityType: "todoLists",
    operation: "update",
    buildPath: ({ listId }) =>
      `/workspaces/${workspace.id}/todo-lists/${listId}`,
    invalidateKeys: [["todoLists", workspace.id]],
  });
}

export function useDeleteTodoList() {
  const { workspace } = useWorkspace();

  return useOfflineDeleteMutation<string>({
    mutationFn: async (listId) => {
      await apiClient.delete(
        `/workspaces/${workspace.id}/todo-lists/${listId}`,
      );
    },
    table: db.todoLists as any,
    entityType: "todoLists",
    buildPath: (listId) => `/workspaces/${workspace.id}/todo-lists/${listId}`,
    getEntityId: (listId) => listId,
    invalidateKeys: [["todoLists", workspace.id]],
  });
}

export function useCreateTodo() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    Todo,
    {
      listId: string;
      data: {
        title: string;
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
        doDate?: string;
        assigneeId?: string;
      };
    }
  >({
    mutationFn: async ({ listId, data }) => {
      const res = await apiClient.post(`/workspaces/${workspace.id}/todos`, {
        ...data,
        listId,
      });
      return res.data as Todo;
    },
    table: db.todos,
    entityType: "todos",
    operation: "create",
    buildPath: () => `/workspaces/${workspace.id}/todos`,
    invalidateKeys: [
      ["todos", workspace.id],
      ["allTodos", workspace.id],
      ["calendar", workspace.id],
    ],
  });
}

export function useUpdateTodo() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    Todo,
    {
      listId: string;
      todoId: string;
      data: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
        doDate?: string;
        assigneeId?: string;
      };
    }
  >({
    mutationFn: async (args) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/todos/${args.todoId}`,
        args.data,
      );
      return res.data as Todo;
    },
    table: db.todos,
    entityType: "todos",
    operation: "update",
    buildPath: (args) => `/workspaces/${workspace.id}/todos/${args.todoId}`,
    invalidateKeys: [
      ["todos", workspace.id],
      ["allTodos", workspace.id],
      [...lightKeys.me],
      ["calendar", workspace.id],
    ],
  });
}

export function useDeleteTodo() {
  const { workspace } = useWorkspace();

  return useOfflineDeleteMutation<{ listId: string; todoId: string }>({
    mutationFn: async (args) => {
      await apiClient.delete(
        `/workspaces/${workspace.id}/todos/${args.todoId}`,
      );
    },
    table: db.todos as any,
    entityType: "todos",
    buildPath: (args) => `/workspaces/${workspace.id}/todos/${args.todoId}`,
    getEntityId: (args) => args.todoId,
    invalidateKeys: [
      ["todos", workspace.id],
      ["allTodos", workspace.id],
      ["calendar", workspace.id],
    ],
  });
}

// --- Online-only operations (complex embedded structures) ---

export function useReorderTodos() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const isOnline = useNetworkStatus();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      items: { id: string; order: number }[];
    }) => {
      if (!isOnline) throw new Error("Reorder requires an internet connection");
      await apiClient.post(`/workspaces/${workspace.id}/todos/reorder`, {
        items: args.items,
      });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allTodos", workspace.id],
      });
    },
  });
}

export function useReorderSubtasks() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const isOnline = useNetworkStatus();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      items: { id: string; order: number }[];
    }) => {
      if (!isOnline) throw new Error("Reorder requires an internet connection");
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/todos/${args.todoId}/subtasks/reorder`,
        { items: args.items },
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allTodos", workspace.id],
      });
    },
  });
}

export function useAddSubtask() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      data: { title: string; priority?: string };
    }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/todos/${args.todoId}/subtasks`,
        args.data,
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allTodos", workspace.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      subtaskId: string;
      data: { title?: string; status?: string; priority?: string };
    }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/todos/${args.todoId}/subtasks/${args.subtaskId}`,
        args.data,
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allTodos", workspace.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
    },
  });
}

export function useRemoveSubtask() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      subtaskId: string;
    }) => {
      await apiClient.delete(
        `/workspaces/${workspace.id}/todos/${args.todoId}/subtasks/${args.subtaskId}`,
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allTodos", workspace.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
    },
  });
}
