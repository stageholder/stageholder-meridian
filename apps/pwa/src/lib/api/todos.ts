// Todos data layer — ONLINE-ONLY.
//
// Every write follows the app's optimistic contract (see `optimistic.ts`):
// optimistic cache write → roll back on error → write the SERVER response into
// the cache on success → invalidate only AGGREGATE keys (light/stats/calendar),
// never the todo lists we just wrote authoritatively. This is what makes
// toggling done, changing a date, creating, deleting, and reordering feel
// instant in production instead of waiting on (and reverting during) a refetch.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TodoList, Todo } from "@repo/core/types";
import { lightKeys } from "./light";
import { todosApi } from "./clients";
import {
  snapshotAndCancel,
  rollback,
  patchLists,
  patchItemInLists,
  writeEntityToLists,
  removeFromLists,
  invalidateAggregates,
  type CacheSnapshot,
} from "./optimistic";

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

// Page size for the flat "all todos" fetch. The server clamps a single page to
// MAX_LIMIT (500), so a user with more todos than that would silently lose rows
// from every derived view (Today/Inbox/Upcoming/Completed) and every sidebar
// count. Walk the pages until a short page signals the end.
const ALL_TODOS_PAGE_SIZE = 500;

export function useAllTodos() {
  return useQuery<Todo[]>({
    queryKey: ["allTodos"],
    queryFn: async () => {
      const all: Todo[] = [];
      for (let page = 1; ; page++) {
        const batch = await todosApi.listAllTodos({
          limit: ALL_TODOS_PAGE_SIZE,
          page,
        });
        all.push(...batch);
        if (batch.length < ALL_TODOS_PAGE_SIZE) break;
      }
      return all;
    },
  });
}

// Todo rows are read from BOTH the per-list `["todos", listId]` caches and the
// flat `["allTodos"]` cache (Today/Inbox/Upcoming/dashboard), so every
// optimistic write and every server-response write must hit both.
const TODO_LIST_KEYS = [["todos"], ["allTodos"]] as const;
// Derived surfaces a todo write affects that we can't recompute locally.
const TODO_AGGREGATE_KEYS = [
  lightKeys.me,
  lightKeys.stats,
  ["calendar"],
] as const;

export function useCreateTodoList() {
  const queryClient = useQueryClient();

  return useMutation<
    TodoList,
    Error,
    { name: string; color?: string; icon?: string },
    { previous: CacheSnapshot; tempId: string }
  >({
    mutationFn: (data) => todosApi.createList(data),
    // Optimistic temp list so the sidebar shows it the instant you submit.
    onMutate: async (data) => {
      const previous = await snapshotAndCancel(queryClient, [["todoLists"]]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        name: data.name,
        color: data.color,
        icon: data.icon,
        order: Number.MAX_SAFE_INTEGER,
        isDefault: false,
      } as unknown as TodoList;
      patchLists<TodoList>(queryClient, [["todoLists"]], (list) => [
        ...list,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverList, _v, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(
          queryClient,
          [["todoLists"]],
          serverList,
          ctx.tempId,
        );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
    },
  });
}

export function useUpdateTodoList() {
  const queryClient = useQueryClient();

  return useMutation<
    TodoList,
    Error,
    { listId: string; data: { name?: string; color?: string; icon?: string } },
    { previous: CacheSnapshot }
  >({
    mutationFn: ({ listId, data }) => todosApi.updateList(listId, data),
    onMutate: async ({ listId, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["todoLists"],
        ["todoList", listId],
      ]);
      patchItemInLists<TodoList>(queryClient, [["todoLists"]], listId, data);
      // The detail header reads the singleton ["todoList", id] cache.
      const detail = queryClient.getQueryData<TodoList>(["todoList", listId]);
      if (detail)
        queryClient.setQueryData(["todoList", listId], { ...detail, ...data });
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverList, { listId }) => {
      writeEntityToLists(queryClient, [["todoLists"]], serverList);
      queryClient.setQueryData(["todoList", listId], serverList);
    },
    // Nothing to invalidate — both caches now hold the authoritative record.
  });
}

export function useDeleteTodoList() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previous: CacheSnapshot }>({
    mutationFn: (listId) => todosApi.deleteList(listId),
    onMutate: async (listId) => {
      const previous = await snapshotAndCancel(queryClient, [["todoLists"]]);
      removeFromLists<TodoList>(queryClient, [["todoLists"]], listId);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: () => {
      // Deleting a list cascades a soft-delete to its todos server-side, so
      // every todo cache that could still hold them must refetch — otherwise
      // they linger as "Unknown List" ghost rows in Today/Inbox/Upcoming.
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
      void queryClient.invalidateQueries({ queryKey: ["allTodos"] });
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useReorderTodoLists() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { items: { id: string; order: number }[] },
    { previous: TodoList[] | undefined }
  >({
    mutationFn: (data) => todosApi.reorderLists(data),
    // Optimistically apply the new ordering so the sidebar doesn't snap back to
    // the pre-drag order between drop and refetch.
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: ["todoLists"] });
      const previous = queryClient.getQueryData<TodoList[]>(["todoLists"]);
      if (Array.isArray(previous)) {
        const orderById = new Map(items.map((i) => [i.id, i.order]));
        const next = previous
          .map((l) =>
            orderById.has(l.id) ? { ...l, order: orderById.get(l.id)! } : l,
          )
          // Mirror the server sort: default Inbox first, then by order.
          .sort(
            (a, b) =>
              Number(b.isDefault) - Number(a.isDefault) || a.order - b.order,
          );
        queryClient.setQueryData<TodoList[]>(["todoLists"], next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["todoLists"], context.previous);
    },
    // No settle-refetch: the optimistic order already matches the server's.
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
    },
    { previous: CacheSnapshot; tempId: string; listId: string }
  >({
    mutationFn: ({ listId, data }) => todosApi.createTodo(listId, data),
    // Optimistic temp row so a newly-added todo appears the instant you submit,
    // instead of after a create + refetch round-trip.
    onMutate: async ({ listId, data }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        listId,
        title: data.title,
        description: data.description,
        status: data.status ?? "todo",
        priority: data.priority ?? "none",
        dueDate: data.dueDate,
        doDate: data.doDate,
        order: Number.MAX_SAFE_INTEGER,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Todo;
      patchLists<Todo>(queryClient, [["todos", listId]], (l) => [
        ...l,
        optimistic,
      ]);
      patchLists<Todo>(queryClient, [["allTodos"]], (l) => [...l, optimistic]);
      return { previous, tempId, listId };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverTodo, _v, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(queryClient, TODO_LIST_KEYS, serverTodo, ctx.tempId);
    },
    onSettled: () => {
      // Only the calendar (a derived surface) still needs a refresh.
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

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
    { previous: CacheSnapshot }
  >({
    mutationFn: (args) =>
      todosApi.updateTodo(args.listId, args.todoId, args.data),
    onMutate: async ({ todoId, data }) => {
      // Patch every list the row renders in (per-list + flat all-todos) so the
      // checkbox / date / priority flips instantly wherever it's shown. Nulls
      // from the form clear a field; mirror the server's null→undefined store.
      const patch: Partial<Todo> = {};
      for (const [key, value] of Object.entries(data)) {
        (patch as Record<string, unknown>)[key] =
          value === null ? undefined : value;
      }
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      patchItemInLists<Todo>(queryClient, TODO_LIST_KEYS, todoId, {
        ...patch,
        updatedAt: new Date().toISOString(),
      } as Partial<Todo>);
      return { previous };
    },
    onError: (_err, _vars, context) => rollback(queryClient, context?.previous),
    // Write the server's authoritative row back into every list cache — so we
    // do NOT re-invalidate (and re-fetch, and briefly revert) the lists.
    onSuccess: (serverTodo) => {
      writeEntityToLists(queryClient, TODO_LIST_KEYS, serverTodo);
    },
    onSettled: () => {
      // Only the derived surfaces — the lists already hold the server record.
      invalidateAggregates(queryClient, TODO_AGGREGATE_KEYS);
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { listId: string; todoId: string },
    { previous: CacheSnapshot }
  >({
    mutationFn: (args) => todosApi.deleteTodo(args.listId, args.todoId),
    // Optimistically drop the row so it disappears on tap, not after a refetch.
    onMutate: async ({ todoId }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      removeFromLists<Todo>(queryClient, TODO_LIST_KEYS, todoId);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// --- Online-only operations (complex embedded structures) ---

export function useReorderTodos() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { listId: string; items: { id: string; order: number }[] },
    { previousList: Todo[] | undefined; previousAll: Todo[] | undefined }
  >({
    mutationFn: async (args) => {
      await todosApi.reorderTodos(args.listId, { items: args.items });
    },
    // Optimistically re-slot so the list holds the dropped order instead of
    // flickering back until the refetch lands.
    onMutate: async ({ listId, items }) => {
      await queryClient.cancelQueries({ queryKey: ["todos", listId] });
      await queryClient.cancelQueries({ queryKey: ["allTodos"] });
      const orderById = new Map(items.map((i) => [i.id, i.order]));
      const previousList = queryClient.getQueryData<Todo[]>(["todos", listId]);
      const previousAll = queryClient.getQueryData<Todo[]>(["allTodos"]);
      if (Array.isArray(previousList)) {
        queryClient.setQueryData<Todo[]>(
          ["todos", listId],
          previousList
            .map((t) =>
              orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t,
            )
            .sort((a, b) => a.order - b.order),
        );
      }
      if (Array.isArray(previousAll)) {
        queryClient.setQueryData<Todo[]>(
          ["allTodos"],
          previousAll.map((t) =>
            orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t,
          ),
        );
      }
      return { previousList, previousAll };
    },
    onError: (_err, { listId }, context) => {
      if (context?.previousList)
        queryClient.setQueryData(["todos", listId], context.previousList);
      if (context?.previousAll)
        queryClient.setQueryData(["allTodos"], context.previousAll);
    },
    // No settle-refetch: optimistic order already matches the server.
  });
}

// Subtasks live embedded on the parent Todo, so every subtask write is an
// optimistic patch of that parent row across both list caches, then a
// server-response write on success. No list re-fetch.
function patchParentSubtasks(
  queryClient: ReturnType<typeof useQueryClient>,
  todoId: string,
  update: (subtasks: NonNullable<Todo["subtasks"]>) => Todo["subtasks"],
) {
  patchLists<Todo>(queryClient, TODO_LIST_KEYS, (list) =>
    list.map((t) =>
      t.id === todoId ? { ...t, subtasks: update(t.subtasks ?? []) } : t,
    ),
  );
}

export function useReorderSubtasks() {
  const queryClient = useQueryClient();

  return useMutation<
    Todo,
    Error,
    { listId: string; todoId: string; items: { id: string; order: number }[] },
    { previous: CacheSnapshot }
  >({
    mutationFn: (args) =>
      todosApi.reorderSubtasks(args.todoId, { items: args.items }),
    onMutate: async ({ todoId, items }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      const orderById = new Map(items.map((i) => [i.id, i.order]));
      patchParentSubtasks(queryClient, todoId, (subs) =>
        [...subs]
          .map((s) =>
            orderById.has(s.id) ? { ...s, order: orderById.get(s.id)! } : s,
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverTodo) =>
      writeEntityToLists(queryClient, TODO_LIST_KEYS, serverTodo),
  });
}

export function useAddSubtask() {
  const queryClient = useQueryClient();

  return useMutation<
    Todo,
    Error,
    {
      listId: string;
      todoId: string;
      data: { title: string; priority?: string };
    },
    { previous: CacheSnapshot }
  >({
    mutationFn: (args) => todosApi.addSubtask(args.todoId, args.data),
    onMutate: async ({ todoId, data }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      const tempSub = {
        id: `temp-${Date.now()}`,
        title: data.title,
        status: "todo",
        priority: data.priority ?? "none",
        order: Number.MAX_SAFE_INTEGER,
      } as unknown as NonNullable<Todo["subtasks"]>[number];
      patchParentSubtasks(queryClient, todoId, (subs) => [...subs, tempSub]);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverTodo) =>
      writeEntityToLists(queryClient, TODO_LIST_KEYS, serverTodo),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation<
    Todo,
    Error,
    {
      listId: string;
      todoId: string;
      subtaskId: string;
      data: { title?: string; status?: string; priority?: string };
    },
    { previous: CacheSnapshot }
  >({
    mutationFn: (args) =>
      todosApi.updateSubtask(args.todoId, args.subtaskId, args.data),
    onMutate: async ({ todoId, subtaskId, data }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      patchParentSubtasks(queryClient, todoId, (subs) =>
        subs.map((s) => (s.id === subtaskId ? { ...s, ...data } : s)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverTodo) =>
      writeEntityToLists(queryClient, TODO_LIST_KEYS, serverTodo),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useRemoveSubtask() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { listId: string; todoId: string; subtaskId: string },
    { previous: CacheSnapshot }
  >({
    mutationFn: async (args) => {
      await todosApi.removeSubtask(args.todoId, args.subtaskId);
    },
    onMutate: async ({ todoId, subtaskId }) => {
      const previous = await snapshotAndCancel(queryClient, TODO_LIST_KEYS);
      patchParentSubtasks(queryClient, todoId, (subs) =>
        subs.filter((s) => s.id !== subtaskId),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
