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
import {
  snapshotAndCancel,
  rollback,
  patchLists,
  writeEntityToLists,
  type CacheSnapshot,
} from "../optimistic";

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

/* ------------------------- List mutations ---------------------------- */
// PWA parity (apps/pwa/src/lib/api/todos.ts): create / rename+recolor /
// delete a todo list. Deleting a list also affects its todos server-side,
// so both caches invalidate.

export type TodoListInput = { name: string; color?: string };

export function useCreateTodoList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TodoListInput) => {
      const { data } = await apiClient.post<TodoList>("/todo-lists", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListKeys.all }),
  });
}

export function useUpdateTodoList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TodoListInput }) => {
      const { data } = await apiClient.patch<TodoList>(
        `/todo-lists/${id}`,
        patch,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListKeys.all }),
  });
}

export function useDeleteTodoList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todo-lists/${id}`);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoListKeys.all });
      void qc.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}

export function useReorderTodoLists() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { items: { id: string; order: number }[] }) => {
      await apiClient.post("/todo-lists/reorder", data);
    },
    // Optimistically apply the new order so a dropped list holds its position
    // instead of snapping back until the refetch lands.
    onMutate: async ({ items }) => {
      const previous = await snapshotAndCancel(qc, [todoListKeys.lists()]);
      const orderById = new Map(items.map((i) => [i.id, i.order]));
      patchLists<TodoList>(qc, [todoListKeys.lists()], (l) =>
        [...l]
          .map((x) =>
            orderById.has(x.id) ? { ...x, order: orderById.get(x.id)! } : x,
          )
          .sort(
            (a, b) =>
              Number(b.isDefault) - Number(a.isDefault) || a.order - b.order,
          ),
      );
      return { previous };
    },
    onError: (
      _e: unknown,
      _v: unknown,
      ctx: { previous?: CacheSnapshot } | undefined,
    ) => rollback(qc, ctx?.previous),
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateTodoInput = {
  title: string;
  description?: string | null;
  priority?: TodoPriority;
  // `null` clears the date (PATCH); `undefined` leaves it untouched. Widened
  // from `string` so the edit sheet can persist a cleared date.
  dueDate?: string | null;
  doDate?: string | null;
  listId?: string;
};

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const { data } = await apiClient.post<Todo>("/todos", input);
      return data;
    },
    // Optimistic temp row so a newly-added todo appears the instant you submit.
    onMutate: async (input: CreateTodoInput) => {
      const previous = await snapshotAndCancel(qc, [todoKeys.lists()]);
      const tempId = `optimistic-${Date.now()}`;
      const optimistic = {
        id: tempId,
        listId: input.listId,
        title: input.title,
        description: input.description ?? undefined,
        status: "todo",
        priority: input.priority ?? "none",
        dueDate: input.dueDate ?? undefined,
        doDate: input.doDate ?? undefined,
        order: Number.MAX_SAFE_INTEGER,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Todo;
      patchLists<Todo>(qc, [todoKeys.lists()], (l) => [...l, optimistic]);
      return { previous, tempId };
    },
    onError: (
      _e: unknown,
      _v: unknown,
      ctx: { previous?: CacheSnapshot } | undefined,
    ) => rollback(qc, ctx?.previous),
    onSuccess: (
      server: Todo,
      _v: CreateTodoInput,
      ctx: { tempId?: string } | undefined,
    ) => {
      if (ctx?.tempId)
        writeEntityToLists(qc, [todoKeys.lists()], server, ctx.tempId);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
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
      // `patch` allows `null` (clear a date/description); a Todo stores the
      // cleared shape as `undefined`. Normalize null→undefined so the
      // optimistic record matches what the server will return (mirrors the
      // PWA's useUpdateTodo), rather than casting null into the Todo type.
      const normalized: Partial<Todo> = {};
      for (const [k, v] of Object.entries(patch)) {
        (normalized as Record<string, unknown>)[k] = v === null ? undefined : v;
      }
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Todo[]>(
          key,
          prev.map((t) =>
            t.id === id
              ? { ...t, ...normalized, updatedAt: new Date().toISOString() }
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
    // Write the server's authoritative row into every list cache so we do NOT
    // re-fetch (and briefly revert) the lists. Only the calendar (derived) is
    // invalidated.
    onSuccess: (server: Todo) =>
      writeEntityToLists(qc, [todoKeys.lists()], server),
    onSettled: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
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

/* ----------------------------- Subtasks ---------------------------------- */
//
// Subtasks live under /todos/:id/subtasks. We optimistically update the
// parent todo's subtasks array in every cached list so the TodoDetailSheet
// reflects changes instantly. Server returns the updated parent Todo on
// every mutation, which we use to settle the cache.

type Subtask = NonNullable<Todo["subtasks"]>[number];

export type CreateSubtaskInput = { todoId: string; title: string };
export type UpdateSubtaskInput = {
  todoId: string;
  subtaskId: string;
  patch: { title?: string; status?: "todo" | "done" };
};
export type DeleteSubtaskInput = { todoId: string; subtaskId: string };

function patchTodoInCaches(
  qc: ReturnType<typeof useQueryClient>,
  todoId: string,
  apply: (t: Todo) => Todo,
) {
  const snapshots = qc.getQueriesData<Todo[]>({ queryKey: todoKeys.lists() });
  for (const [key, prev] of snapshots) {
    if (!prev) continue;
    qc.setQueryData<Todo[]>(
      key,
      prev.map((t) => (t.id === todoId ? apply(t) : t)),
    );
  }
  return snapshots;
}

export function useAddSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubtaskInput) => {
      const { data } = await apiClient.post<Todo>(
        `/todos/${input.todoId}/subtasks`,
        { title: input.title },
      );
      return data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() });
      const snapshots = patchTodoInCaches(qc, input.todoId, (t) => ({
        ...t,
        subtasks: [
          ...(t.subtasks ?? []),
          {
            id: `optimistic-${Date.now()}`,
            title: input.title,
            status: "todo",
            order: t.subtasks?.length ?? 0,
          } as Subtask,
        ],
      }));
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    // Server returns the updated parent Todo — write it back (no list refetch).
    onSuccess: (server: Todo) =>
      writeEntityToLists(qc, [todoKeys.lists()], server),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSubtaskInput) => {
      const { data } = await apiClient.patch<Todo>(
        `/todos/${input.todoId}/subtasks/${input.subtaskId}`,
        input.patch,
      );
      return data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() });
      const snapshots = patchTodoInCaches(qc, input.todoId, (t) => ({
        ...t,
        subtasks: (t.subtasks ?? []).map((s) =>
          s.id === input.subtaskId ? ({ ...s, ...input.patch } as Subtask) : s,
        ),
      }));
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    // Server returns the updated parent Todo — write it back (no list refetch).
    onSuccess: (server: Todo) =>
      writeEntityToLists(qc, [todoKeys.lists()], server),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteSubtaskInput) => {
      await apiClient.delete(
        `/todos/${input.todoId}/subtasks/${input.subtaskId}`,
      );
      return input;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() });
      const snapshots = patchTodoInCaches(qc, input.todoId, (t) => ({
        ...t,
        subtasks: (t.subtasks ?? []).filter((s) => s.id !== input.subtaskId),
      }));
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  });
}
