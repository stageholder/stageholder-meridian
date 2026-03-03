import type { AxiosInstance } from 'axios';
import type { TodoList, Todo } from '@repo/core/types';
import { workspacePath } from './client';

export function createTodosApi(client: AxiosInstance, getWorkspaceId: () => string) {
  const wp = (path: string) => workspacePath(getWorkspaceId(), path);

  return {
    // Todo Lists
    createList: async (data: { name: string; color?: string; icon?: string; isShared?: boolean }): Promise<TodoList> => {
      const res = await client.post(wp('/todo-lists'), data);
      return res.data;
    },
    listLists: async (): Promise<TodoList[]> => {
      const res = await client.get(wp('/todo-lists'));
      return res.data;
    },
    getList: async (listId: string): Promise<TodoList> => {
      const res = await client.get(wp(`/todo-lists/${listId}`));
      return res.data;
    },
    updateList: async (listId: string, data: { name?: string; color?: string; icon?: string; isShared?: boolean }): Promise<TodoList> => {
      const res = await client.patch(wp(`/todo-lists/${listId}`), data);
      return res.data;
    },
    deleteList: async (listId: string): Promise<void> => {
      await client.delete(wp(`/todo-lists/${listId}`));
    },

    // Todos
    createTodo: async (listId: string, data: {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
    }): Promise<Todo> => {
      const res = await client.post(wp(`/todo-lists/${listId}/todos`), data);
      return res.data;
    },
    listTodos: async (listId: string): Promise<Todo[]> => {
      const res = await client.get(wp(`/todo-lists/${listId}/todos`));
      return res.data;
    },
    getTodo: async (listId: string, todoId: string): Promise<Todo> => {
      const res = await client.get(wp(`/todo-lists/${listId}/todos/${todoId}`));
      return res.data;
    },
    updateTodo: async (listId: string, todoId: string, data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
    }): Promise<Todo> => {
      const res = await client.patch(wp(`/todo-lists/${listId}/todos/${todoId}`), data);
      return res.data;
    },
    deleteTodo: async (listId: string, todoId: string): Promise<void> => {
      await client.delete(wp(`/todo-lists/${listId}/todos/${todoId}`));
    },
    reorderTodos: async (listId: string, data: { todoIds: string[] }): Promise<void> => {
      await client.post(wp(`/todo-lists/${listId}/todos/reorder`), data);
    },
  };
}

export type TodosApi = ReturnType<typeof createTodosApi>;
