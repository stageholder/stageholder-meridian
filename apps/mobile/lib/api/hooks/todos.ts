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

import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Todo, TodoList } from "@repo/core/types";

import { apiClient } from "../client";
import { todoKeys, todoListKeys } from "../keys";
import {
  invalidateDashboardToday,
  invalidateDebounced,
  patchDashboardTodo,
  removeDashboardTodo,
  settleDerivedAggregates,
  writeDashboardTodo,
} from "../dashboard-cache";

// DATA-LAYER CONTRACT — see hooks/habits.ts: one optimistic setQueriesData
// write for the HOT taps (toggle / swipe-delete), standard invalidation for
// everything else. A todo's calendar presence refreshes via its due/do-day
// MONTHS only, never the whole ["calendar"] prefix.

/** Invalidate only the month(s) a dated todo can appear in. Dateless todos
 *  never appear on the calendar — zero invalidations. */
function invalidateTodoMonths(
  qc: QueryClient,
  dates: Array<string | null | undefined>,
) {
  const months = new Set(
    dates.filter((d): d is string => !!d).map((d) => d.slice(0, 7)),
  );
  for (const month of months) {
    // Debounced per month — see habits.ts settleCalendarMonth.
    invalidateDebounced(qc, ["calendar", month], 1000);
  }
}

export type TodoStatus = Todo["status"];
export type TodoPriority = Todo["priority"];

/* ------------------------------ Reads -------------------------------- */

// The API pages /todos (DEFAULT_LIMIT 20, MAX_LIMIT 500). Without an explicit
// limit only the 20 newest todos ever reached the Todos tab and the calendar
// agenda. Walk full pages until a short one, same as the PWA's useAllTodos.
const TODOS_PAGE_SIZE = 500;

export function useTodos(filters?: { listId?: string }) {
  return useQuery({
    queryKey: todoKeys.list(filters),
    queryFn: async () => {
      const all: Todo[] = [];
      for (let page = 1; ; page++) {
        const { data } = await apiClient.get<{ data: Todo[] } | Todo[]>(
          "/todos",
          { params: { ...filters, limit: TODOS_PAGE_SIZE, page } },
        );
        const batch = Array.isArray(data) ? data : data.data;
        all.push(...batch);
        if (batch.length < TODOS_PAGE_SIZE) break;
      }
      return all;
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
      // Deleting a list cascades to its todos server-side, so Today's rows can
      // change wholesale.
      invalidateDashboardToday(qc);
    },
  });
}

export function useReorderTodoLists() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { items: { id: string; order: number }[] }) => {
      await apiClient.post("/todo-lists/reorder", data);
    },
    // Hold the dropped position instead of snapping back; a failed save
    // self-heals via the error refetch.
    onMutate: ({ items }) => {
      const orderById = new Map(items.map((i) => [i.id, i.order]));
      qc.setQueriesData<TodoList[]>(
        { queryKey: todoListKeys.lists() },
        (list) =>
          Array.isArray(list)
            ? [...list]
                .map((x) =>
                  orderById.has(x.id)
                    ? { ...x, order: orderById.get(x.id)! }
                    : x,
                )
                .sort(
                  (a, b) =>
                    Number(b.isDefault) - Number(a.isDefault) ||
                    a.order - b.order,
                )
            : list,
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: todoListKeys.lists() }),
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
  // Plain create → refetch. No temp-row theater: the create sheet closes on
  // success and the list refetch lands in the same beat.
  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const { data } = await apiClient.post<Todo>("/todos", input);
      return data;
    },
    onSuccess: (server) => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists() });
      invalidateTodoMonths(qc, [server.dueDate, server.doDate]);
      // A todo dated today belongs in the Today widget + the todo ring's
      // denominator. Write the server row straight in rather than refetching
      // the whole aggregate — we already hold the authoritative record.
      writeDashboardTodo(qc, server);
    },
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
    // Instant flip (toggle is THE hot tap): patch the todo in every cached
    // list. The pre-edit dates ride the context so a date edit also
    // refreshes the months the todo is moving OUT of.
    onMutate: ({ id, patch }) => {
      let prevDates: Array<string | undefined> = [];
      // `patch` allows `null` (clear a date/description); a Todo stores the
      // cleared shape as `undefined` — normalize so the optimistic record
      // matches what the server will return.
      const normalized: Partial<Todo> = {};
      for (const [k, v] of Object.entries(patch)) {
        (normalized as Record<string, unknown>)[k] = v === null ? undefined : v;
      }
      const now = new Date().toISOString();
      // Mirror the server's completedAt bookkeeping so Today's "done today"
      // count (keyed on completedAt) flips on the tap frame, not after the
      // response lands.
      const completion: Partial<Todo> =
        patch.status === "done"
          ? { completedAt: now }
          : patch.status !== undefined
            ? { completedAt: undefined }
            : {};
      const applyPatch = (t: Todo): Todo => ({
        ...t,
        ...normalized,
        ...completion,
        updatedAt: now,
      });
      qc.setQueriesData<Todo[]>({ queryKey: todoKeys.lists() }, (list) =>
        Array.isArray(list)
          ? list.map((t) => {
              if (t.id !== id) return t;
              prevDates = [t.dueDate, t.doDate];
              return applyPatch(t);
            })
          : list,
      );
      // Mirror into /dashboard/today so a checkbox tap IN the Today widget
      // flips on the tap frame. Without this the aggregate has no edge from
      // todo mutations at all and the widget never updates (Today is a tab
      // root, so it never unmounts and never refetches on its own).
      patchDashboardTodo(qc, id, applyPatch);
      return { prevDates };
    },
    // Self-heal a failed write via refetch (replaces bespoke rollback).
    onError: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists() });
      invalidateDashboardToday(qc);
    },
    // The todo's calendar-month buckets refresh scoped to its old + new
    // dates; a dateless toggle costs zero calendar work.
    onSuccess: (server: Todo, _vars, ctx) => {
      invalidateTodoMonths(qc, [
        server.dueDate,
        server.doDate,
        ...(ctx?.prevDates ?? []),
      ]);
      // Swap the optimistic row for the authoritative one (e.g. the server's
      // `completedAt`/`updatedAt`) without refetching the aggregate. A date
      // edit can also move a todo INTO today's window, so this inserts too.
      writeDashboardTodo(qc, server);
      // Completing a todo earns Light / moves the todo-ring streak.
      settleDerivedAggregates(qc, { dashboard: false });
    },
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
  // STABLE callbacks: `update.mutate` is referentially stable across renders
  // (React Query binds it once), so these are too. Fresh arrows here used to
  // bust every `useCallback([toggle.mutate])` downstream → memo(TodoRow) never
  // bailed and FlashList re-rendered every visible row on any screen render.
  const { mutate: baseMutate, mutateAsync: baseMutateAsync } = update;
  const mutate = useCallback(
    (todo: Vars, options?: Options) => baseMutate(flipTodo(todo), options),
    [baseMutate],
  );
  const mutateAsync = useCallback(
    (todo: Vars, options?: Options) => baseMutateAsync(flipTodo(todo), options),
    [baseMutateAsync],
  );
  return { ...update, mutate, mutateAsync };
}

function flipTodo(todo: Pick<Todo, "id" | "status">) {
  return {
    id: todo.id,
    patch: {
      status: todo.status === "done" ? ("todo" as const) : ("done" as const),
    },
  };
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/todos/${id}`);
      return id;
    },
    // Instant removal (swipe-delete); pre-delete dates ride the context so
    // only the affected months refresh.
    onMutate: (id) => {
      let prevDates: Array<string | undefined> = [];
      qc.setQueriesData<Todo[]>({ queryKey: todoKeys.lists() }, (list) => {
        if (!Array.isArray(list)) return list;
        const gone = list.find((t) => t.id === id);
        if (gone) prevDates = [gone.dueDate, gone.doDate];
        return list.filter((t) => t.id !== id);
      });
      // Instant removal from the Today widget too.
      removeDashboardTodo(qc, id);
      return { prevDates };
    },
    onSettled: (_id, err, _vars, ctx) => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists() });
      invalidateTodoMonths(qc, ctx?.prevDates ?? []);
      // ONLY on failure — the optimistic removal above is already correct for
      // the happy path, so invalidating unconditionally would cost an extra
      // aggregate refetch on every swipe-delete. On error the row must come
      // back, and a refetch is the cheapest way to restore it.
      if (err) invalidateDashboardToday(qc);
      else settleDerivedAggregates(qc, { dashboard: false });
    },
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

/** Optimistically patch one todo across every cached list — plus the
 *  /dashboard/today aggregate, which renders the same todo rows. */
function patchTodoInCaches(
  qc: QueryClient,
  todoId: string,
  apply: (t: Todo) => Todo,
) {
  qc.setQueriesData<Todo[]>({ queryKey: todoKeys.lists() }, (list) =>
    Array.isArray(list)
      ? list.map((t) => (t.id === todoId ? apply(t) : t))
      : list,
  );
  patchDashboardTodo(qc, todoId, apply);
}

/** Write the server's authoritative todo into every cached list (used by the
 *  subtask flows, which keep the edit sheet open — a scoped write beats
 *  refetching the whole list per subtask toggle). */
function writeTodo(qc: QueryClient, server: Todo) {
  qc.setQueriesData<Todo[]>({ queryKey: todoKeys.lists() }, (list) =>
    Array.isArray(list)
      ? list.map((t) => (t.id === server.id ? server : t))
      : list,
  );
  writeDashboardTodo(qc, server);
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
    // Instant row in the subtask list; a failed save self-heals via refetch.
    onMutate: (input) => {
      patchTodoInCaches(qc, input.todoId, (t) => ({
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
    },
    onError: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
    // Server returns the updated parent Todo — write it back (no list refetch).
    onSuccess: (server: Todo) => writeTodo(qc, server),
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
    // Instant flip; a failed save self-heals via refetch.
    onMutate: (input) => {
      patchTodoInCaches(qc, input.todoId, (t) => ({
        ...t,
        subtasks: (t.subtasks ?? []).map((s) =>
          s.id === input.subtaskId ? ({ ...s, ...input.patch } as Subtask) : s,
        ),
      }));
    },
    onError: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
    // Server returns the updated parent Todo — write it back (no list refetch).
    onSuccess: (server: Todo) => writeTodo(qc, server),
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
    // Instant removal; the settle refetch restores it if the delete failed.
    onMutate: (input) => {
      patchTodoInCaches(qc, input.todoId, (t) => ({
        ...t,
        subtasks: (t.subtasks ?? []).filter((s) => s.id !== input.subtaskId),
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  });
}
