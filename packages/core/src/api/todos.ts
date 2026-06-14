import type { ApiClientLike } from "./client";
import type { TodoList, Todo } from "@repo/core/types";

/**
 * Todos + todo-lists API client. Routes are rooted at `/todos` and
 * `/todo-lists` — scoping is per authenticated user server-side.
 */
export function createTodosApi(client: ApiClientLike) {
  return {
    // Todo Lists
    createList: async (data: {
      name: string;
      color?: string;
      icon?: string;
      isShared?: boolean;
    }): Promise<TodoList> => {
      const res = await client.post(`/todo-lists`, data);
      return res.data;
    },
    listLists: async (params?: Record<string, string>): Promise<TodoList[]> => {
      const res = await client.get(`/todo-lists`, { params });
      return res.data?.data ?? res.data;
    },
    getList: async (listId: string): Promise<TodoList> => {
      const res = await client.get(`/todo-lists/${listId}`);
      return res.data;
    },
    updateList: async (
      listId: string,
      data: {
        name?: string;
        color?: string;
        icon?: string;
        isShared?: boolean;
      },
    ): Promise<TodoList> => {
      const res = await client.patch(`/todo-lists/${listId}`, data);
      return res.data;
    },
    deleteList: async (listId: string): Promise<void> => {
      await client.delete(`/todo-lists/${listId}`);
    },
    /** Reorder todo lists — batch `{ items: [{ id, order }] }`, mirroring
     *  `reorderTodos`. The server applies a sparse update by id. */
    reorderLists: async (data: {
      items: { id: string; order: number }[];
    }): Promise<void> => {
      await client.post(`/todo-lists/reorder`, data);
    },

    // Todos
    createTodo: async (
      listId: string,
      data: {
        title: string;
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
        doDate?: string;
      },
    ): Promise<Todo> => {
      const res = await client.post(`/todos`, { ...data, listId });
      return res.data;
    },
    listTodos: async (listId: string): Promise<Todo[]> => {
      const res = await client.get(`/todos`, { params: { listId } });
      return res.data?.data ?? res.data;
    },
    getTodo: async (_listId: string, todoId: string): Promise<Todo> => {
      const res = await client.get(`/todos/${todoId}`);
      return res.data;
    },
    updateTodo: async (
      _listId: string,
      todoId: string,
      data: {
        title?: string;
        /** `null` clears the field server-side (PATCH semantics). */
        description?: string | null;
        status?: string;
        priority?: string;
        dueDate?: string | null;
        doDate?: string | null;
      },
    ): Promise<Todo> => {
      const res = await client.patch(`/todos/${todoId}`, data);
      return res.data;
    },
    deleteTodo: async (_listId: string, todoId: string): Promise<void> => {
      await client.delete(`/todos/${todoId}`);
    },
    /**
     * Reorder todos within a list. Payload mirrors `reorderSubtasks` — an
     * array of `{ id, order }` pairs (not just an ordered list of ids), so
     * the server can compute a sparse update without re-numbering rows that
     * didn't move. `_listId` is kept on the signature so call sites read
     * symmetrically with the other todo ops, even though the API doesn't
     * need it in the path or body.
     */
    reorderTodos: async (
      _listId: string,
      data: { items: { id: string; order: number }[] },
    ): Promise<void> => {
      await client.post(`/todos/reorder`, data);
    },

    // Subtasks
    addSubtask: async (
      todoId: string,
      data: {
        title: string;
        priority?: string;
      },
    ): Promise<Todo> => {
      const res = await client.post(`/todos/${todoId}/subtasks`, data);
      return res.data;
    },
    updateSubtask: async (
      todoId: string,
      subtaskId: string,
      data: {
        title?: string;
        status?: string;
        priority?: string;
      },
    ): Promise<Todo> => {
      const res = await client.patch(
        `/todos/${todoId}/subtasks/${subtaskId}`,
        data,
      );
      return res.data;
    },
    removeSubtask: async (todoId: string, subtaskId: string): Promise<Todo> => {
      const res = await client.delete(`/todos/${todoId}/subtasks/${subtaskId}`);
      return res.data;
    },
    reorderSubtasks: async (
      todoId: string,
      data: { items: { id: string; order: number }[] },
    ): Promise<Todo> => {
      const res = await client.post(`/todos/${todoId}/subtasks/reorder`, data);
      return res.data;
    },

    listAllTodos: async (params?: Record<string, unknown>): Promise<Todo[]> => {
      const res = await client.get(`/todos`, { params });
      return res.data?.data ?? res.data;
    },
  };
}

export type TodosApi = ReturnType<typeof createTodosApi>;
