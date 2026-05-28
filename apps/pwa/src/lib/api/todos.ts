import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { todosApi } from "./clients";
import { useCallback } from "react";

export function useTodoLists() {
  return useOfflineQuery<TodoList>(["todoLists"], db.todoLists, () =>
    todosApi.listLists(),
  );
}

export function useTodoList(listId: string) {
  return useOfflineQuerySingle<TodoList>(
    ["todoList", listId],
    db.todoLists,
    listId,
    () => todosApi.getList(listId),
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
    () => todosApi.listTodos(listId),
    db.todos,
    { enabled: !!listId },
  );
}

export function useAllTodos() {
  return useOfflineQuery<Todo>(["allTodos"], db.todos, () =>
    todosApi.listAllTodos({ limit: 500 }),
  );
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
    mutationFn: (data) => todosApi.createList(data),
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
    mutationFn: ({ listId, data }) => todosApi.updateList(listId, data),
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
    mutationFn: (listId) => todosApi.deleteList(listId),
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
    mutationFn: ({ listId, data }) => todosApi.createTodo(listId, data),
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
    mutationFn: (args) =>
      todosApi.updateTodo(args.listId, args.todoId, args.data),
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
    mutationFn: (args) => todosApi.deleteTodo(args.listId, args.todoId),
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
      await todosApi.reorderTodos(args.listId, { items: args.items });
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
      // Factory `reorderSubtasks` returns the updated Todo from the server;
      // preserve that return shape.
      return todosApi.reorderSubtasks(args.todoId, { items: args.items });
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
    mutationFn: (args: {
      listId: string;
      todoId: string;
      data: { title: string; priority?: string };
    }) => todosApi.addSubtask(args.todoId, args.data),
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
    mutationFn: (args: {
      listId: string;
      todoId: string;
      subtaskId: string;
      data: { title?: string; status?: string; priority?: string };
    }) => todosApi.updateSubtask(args.todoId, args.subtaskId, args.data),
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
      // Factory `removeSubtask` returns the updated Todo. The hook previously
      // discarded the response (apiClient.delete with no return), so we still
      // return void here to preserve call-site shape.
      await todosApi.removeSubtask(args.todoId, args.subtaskId);
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
