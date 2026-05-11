// apps/mobile/lib/api/hooks/todos.ts
//
// React Query hooks for the /todos and /todo-lists resources. Mirrors the
// PWA's hook shape so a dev working across both surfaces sees the same
// conventions. Types come from @repo/core/types — the API contract is the
// single source of truth.
//
// Optimistic updates on the two highest-traffic mutations:
//   - useToggleTodo: instant strike-through on the checkbox tap
//   - useDeleteTodo: instant row removal on swipe-to-delete
// Rollback on error via snapshotted previous state.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Todo, TodoList } from "@repo/core/types";

import { apiClient } from "../client";
import { todoKeys, todoListKeys } from "../keys";

export type TodoStatus = Todo["status"];
export type TodoPriority = Todo["priority"];

/* ------------------------------ Reads -------------------------------- */

export function useTodos(filters?: { listId?: string }) {
  return useQuery({
    queryKey: todoKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Todo[] } | Todo[]>(
        "/todos",
        {
          params: filters,
        },
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export function useTodo(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? todoKeys.detail(id) : todoKeys.detail("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<Todo>(`/todos/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useTodoLists() {
  return useQuery({
    queryKey: todoListKeys.lists(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TodoList[] } | TodoList[]>(
        "/todo-lists",
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateTodoInput = {
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string;
  doDate?: string;
  listId?: string;
};

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const { data } = await apiClient.post<Todo>("/todos", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  });
}

export type UpdateTodoInput = Partial<CreateTodoInput> & {
  status?: TodoStatus;
};

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateTodoInput;
    }) => {
      const { data } = await apiClient.patch<Todo>(`/todos/${id}`, patch);
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() });
      const snapshots = qc.getQueriesData<Todo[]>({
        queryKey: todoKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Todo[]>(
          key,
          prev.map((t) =>
            t.id === id
              ? { ...t, ...patch, updatedAt: new Date().toISOString() }
              : t,
          ),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  });
}

/**
 * Toggle done/todo. The most common interaction in the app — checkbox tap,
 * swipe-right-for-done. Reads status from the snapshot so the server doesn't
 * need to be the source of truth for the flip direction.
 *
 * Wraps useUpdateTodo so callers pass `{ id, status }` instead of the
 * update payload, while still passing through React Query mutation options.
 */
export function useToggleTodo() {
  const update = useUpdateTodo();
  type Vars = Pick<Todo, "id" | "status">;
  type Options = Parameters<typeof update.mutate>[1];
  const flip = (todo: Vars) => ({
    id: todo.id,
    patch: {
      status: todo.status === "done" ? ("todo" as const) : ("done" as const),
    },
  });
  return {
    ...update,
    mutate: (todo: Vars, options?: Options) =>
      update.mutate(flip(todo), options),
    mutateAsync: (todo: Vars, options?: Options) =>
      update.mutateAsync(flip(todo), options),
  };
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todos/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() });
      const snapshots = qc.getQueriesData<Todo[]>({
        queryKey: todoKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Todo[]>(
          key,
          prev.filter((t) => t.id !== id),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  });
}
