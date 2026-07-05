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

export function useCreateTodoList() {
  const queryClient = useQueryClient();

  return useMutation<
    TodoList,
    Error,
    {
      name: string;
      color?: string;
      icon?: string;
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
      };
    }
  >({
    mutationFn: ({ listId, data }) => todosApi.updateList(listId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
      // The list detail page header reads a separate ["todoList", id] query;
      // without this it keeps the stale name/color until navigation.
      void queryClient.invalidateQueries({
        queryKey: ["todoList", variables.listId],
      });
    },
  });
}

export function useDeleteTodoList() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (listId) => todosApi.deleteList(listId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists"] });
      // Deleting a list cascades a soft-delete to its todos server-side, so
      // every todo cache that could still hold them must refetch — otherwise
      // they linger as "Unknown List" ghost rows in Today/Inbox/Upcoming and
      // keep the sidebar counts inflated.
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
    onSettled: () => {
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
        // Patch order fields only — allTodos spans every list, so a global
        // re-sort would interleave them; the derived views bucket it themselves.
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
    onSettled: (_data, _err, { listId }) => {
      void queryClient.invalidateQueries({ queryKey: ["todos", listId] });
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
