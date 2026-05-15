import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
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
import { getCurrentUserSub } from "@/lib/current-user-sub";
import { lightKeys } from "./light";
import { useCallback } from "react";

export function useTodoLists() {
  return useOfflineQuery<TodoList>(["todoLists"], db.todoLists, async () => {
    const res = await apiClient.get(`/todo-lists`);
    return res.data?.data ?? res.data;
  });
}

export function useTodoList(listId: string) {
  return useOfflineQuerySingle<TodoList>(
    ["todoList", listId],
    db.todoLists,
    listId,
    async () => {
      const res = await apiClient.get(`/todo-lists/${listId}`);
      return res.data;
    },
    { enabled: !!listId },
  );
}

export function useTodos(listId: string) {
  const localQueryFn = useCallback(
    () => db.todos.where("listId").equals(listId).toArray(),
    [listId],
  );

  return useOfflineQueryFiltered<Todo>(
    ["todos", listId],
    localQueryFn,
    async () => {
      const res = await apiClient.get(`/todos`, {
        params: { listId },
      });
      return res.data;
    },
    db.todos,
    { enabled: !!listId },
  );
}

export function useAllTodos() {
  return useOfflineQuery<Todo>(["allTodos"], db.todos, async () => {
    const res = await apiClient.get(`/todos`, {
      params: { limit: 500 },
    });
    return res.data?.data ?? res.data;
  });
}

export function useCreateTodoList() {
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
      const res = await apiClient.post(`/todo-lists`, data);
      return res.data as TodoList;
    },
    table: db.todoLists,
    entityType: "todoLists",
    operation: "create",
    buildPath: () => `/todo-lists`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["todoLists"]],
  });
}

export function useUpdateTodoList() {
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
      const res = await apiClient.patch(`/todo-lists/${listId}`, data);
      return res.data as TodoList;
    },
    table: db.todoLists,
    entityType: "todoLists",
    operation: "update",
    buildPath: ({ listId }) => `/todo-lists/${listId}`,
    getEntityId: ({ listId }) => listId,
    getPatch: ({ data }) => data as Partial<TodoList>,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["todoLists"]],
  });
}

export function useDeleteTodoList() {
  return useOfflineDeleteMutation<string>({
    mutationFn: async (listId) => {
      await apiClient.delete(`/todo-lists/${listId}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.todoLists as any,
    entityType: "todoLists",
    buildPath: (listId) => `/todo-lists/${listId}`,
    getEntityId: (listId) => listId,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["todoLists"]],
  });
}

export function useCreateTodo() {
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
      };
    }
  >({
    mutationFn: async ({ listId, data }) => {
      const res = await apiClient.post(`/todos`, {
        ...data,
        listId,
      });
      return res.data as Todo;
    },
    table: db.todos,
    entityType: "todos",
    operation: "create",
    buildPath: () => `/todos`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["todos"], ["allTodos"], ["calendar"]],
  });
}

export function useUpdateTodo() {
  return useOfflineMutation<
    Todo,
    {
      listId: string;
      todoId: string;
      data: {
        title?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        dueDate?: string | null;
        doDate?: string | null;
      };
    }
  >({
    mutationFn: async (args) => {
      const res = await apiClient.patch(`/todos/${args.todoId}`, args.data);
      return res.data as Todo;
    },
    table: db.todos,
    entityType: "todos",
    operation: "update",
    buildPath: (args) => `/todos/${args.todoId}`,
    getEntityId: (args) => args.todoId,
    getPatch: (args) => {
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args.data)) {
        patch[key] = value === null ? undefined : value;
      }
      return patch as Partial<Todo>;
    },
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["todos"],
      ["allTodos"],
      [...lightKeys.me],
      [...lightKeys.stats],
      ["calendar"],
    ],
  });
}

export function useDeleteTodo() {
  return useOfflineDeleteMutation<{ listId: string; todoId: string }>({
    mutationFn: async (args) => {
      await apiClient.delete(`/todos/${args.todoId}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.todos as any,
    entityType: "todos",
    buildPath: (args) => `/todos/${args.todoId}`,
    getEntityId: (args) => args.todoId,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["todos"], ["allTodos"], ["calendar"]],
  });
}

// --- Online-only operations (complex embedded structures) ---

export function useReorderTodos() {
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      items: { id: string; order: number }[];
    }) => {
      if (!isOnline) throw new Error("Reorder requires an internet connection");
      await apiClient.post(`/todos/reorder`, {
        items: args.items,
      });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", variables.listId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
    },
  });
}

export function useReorderSubtasks() {
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      items: { id: string; order: number }[];
    }) => {
      if (!isOnline) throw new Error("Reorder requires an internet connection");
      const res = await apiClient.post(
        `/todos/${args.todoId}/subtasks/reorder`,
        { items: args.items },
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", variables.listId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
    },
  });
}

export function useAddSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      data: { title: string; priority?: string };
    }) => {
      const res = await apiClient.post(
        `/todos/${args.todoId}/subtasks`,
        args.data,
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", variables.listId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      subtaskId: string;
      data: { title?: string; status?: string; priority?: string };
    }) => {
      const res = await apiClient.patch(
        `/todos/${args.todoId}/subtasks/${args.subtaskId}`,
        args.data,
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", variables.listId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useRemoveSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      todoId: string;
      subtaskId: string;
    }) => {
      await apiClient.delete(
        `/todos/${args.todoId}/subtasks/${args.subtaskId}`,
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", variables.listId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
