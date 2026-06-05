// Todos data layer — ONLINE-ONLY.
//
// The offline feature (Dexie cache + mutation queue) was removed wholesale and
// will be rebuilt from scratch later. These hooks used to wrap the now-deleted
// `@repo/offline` helpers; this layer is now plain `@tanstack/react-query`.
// Every read hits the API; every write goes straight to the server.
//
// The one interaction that needs to feel instant — toggling a todo
// done/undone — keeps its optimism via the standard TanStack cancel → snapshot
// → setQueryData → rollback-on-error → invalidate pattern (it replaces the old
// optimistic Dexie write). The remaining create/delete/reorder/subtask
// mutations had no UI optimism before (the offline layer only wrote optimistic
// Dexie records on the *offline* branch), so they just invalidate on success.
//
// When the offline rebuild lands it will reintroduce caching BEHIND these same
// hook names + signatures, so consumers should not need to change again.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TodoList, Todo } from "@repo/core/types";
import { lightKeys } from "./light";
import { todosApi } from "./clients";

export function useTodoLists() {
  return useQuery<TodoList[]>({
    queryKey: ["todoLists"],
    queryFn: () => todosApi.listLists(),
  });
}

export function useTodoList(listId: string) {
  return useQuery<TodoList>({
    queryKey: ["todoList", listId],
    queryFn: () => todosApi.getList(listId),
    enabled: !!listId,
  });
}

export function useTodos(listId: string) {
  return useQuery<Todo[]>({
    queryKey: ["todos", listId],
    queryFn: () => todosApi.listTodos(listId),
    enabled: !!listId,
  });
}

export function useAllTodos() {
  return useQuery<Todo[]>({
    queryKey: ["allTodos"],
    queryFn: () => todosApi.listAllTodos({ limit: 500 }),
  });
}

export function useCreateTodoList() {
  const queryClient = useQueryClient();

  return useMutation<
    TodoList,
    Error,
    {
      name: string;
      color?: string;
      icon?: string;
      isShared?: boolean;
    }
  >({
    mutationFn: (data) => todosApi.createList(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
    },
  });
}

export function useUpdateTodoList() {
  const queryClient = useQueryClient();

  return useMutation<
    TodoList,
    Error,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
    },
  });
}

export function useDeleteTodoList() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (listId) => todosApi.deleteList(listId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation<
    Todo,
    Error,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// Snapshot of every cached todo list (per-list `["todos", listId]` variants +
// the flat `["allTodos"]`) so the optimistic toggle can roll back on error.
type TodosSnapshot = Array<[readonly unknown[], Todo[] | undefined]>;

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation<
    Todo,
    Error,
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
    },
    { previous: TodosSnapshot }
  >({
    mutationFn: (args) =>
      todosApi.updateTodo(args.listId, args.todoId, args.data),
    onMutate: async ({ todoId, data }) => {
      // Patch both the per-list cache and the flat all-todos cache so the
      // checkbox flips instantly wherever the row is rendered (list view,
      // today/inbox/upcoming dashboards). Nulls coming from the form clear a
      // field; mirror the old getPatch's null→undefined normalization so the
      // optimistic record matches what the server will store.
      const patch: Partial<Todo> = {};
      for (const [key, value] of Object.entries(data)) {
        (patch as Record<string, unknown>)[key] =
          value === null ? undefined : value;
      }

      await queryClient.cancelQueries({ queryKey: ["todos"] });
      await queryClient.cancelQueries({ queryKey: ["allTodos"] });

      const previous: TodosSnapshot = [
        ...queryClient.getQueriesData<Todo[]>({
          queryKey: ["todos"],
          exact: false,
        }),
        ...queryClient.getQueriesData<Todo[]>({
          queryKey: ["allTodos"],
          exact: false,
        }),
      ];

      for (const [key, list] of previous) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<Todo[]>(
          key,
          list.map((t) =>
            t.id === todoId
              ? { ...t, ...patch, updatedAt: new Date().toISOString() }
              : t,
          ),
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: lightKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { listId: string; todoId: string }>({
    mutationFn: (args) => todosApi.deleteTodo(args.listId, args.todoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// --- Online-only operations (complex embedded structures) ---
//
// These were always online-only (the offline layer never queued them). With
// the offline package gone the explicit `isOnline` guards drop away — the whole
// app is online-only now, so a thrown "requires connection" error would be
// dead code. They keep their per-list + all-todos (+ calendar) invalidations.

export function useReorderTodos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      listId: string;
      items: { id: string; order: number }[];
    }) => {
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

  return useMutation({
    mutationFn: (args: {
      listId: string;
      todoId: string;
      items: { id: string; order: number }[];
    }) => {
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
