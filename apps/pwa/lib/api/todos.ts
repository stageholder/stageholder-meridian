import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { TodoList, Todo } from "@repo/core/types";

export function useTodoLists() {
  const { workspace } = useWorkspace();

  return useQuery<TodoList[]>({
    queryKey: ["todoLists", workspace.id],
    queryFn: async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/todo-lists`
      );
      return res.data?.data ?? res.data;
    },
  });
}

export function useTodoList(listId: string) {
  const { workspace } = useWorkspace();

  return useQuery<TodoList>({
    queryKey: ["todoList", workspace.id, listId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/todo-lists/${listId}`
      );
      return res.data;
    },
    enabled: !!listId,
  });
}

export function useTodos(listId: string) {
  const { workspace } = useWorkspace();

  return useQuery<Todo[]>({
    queryKey: ["todos", workspace.id, listId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/todos`,
        { params: { listId } }
      );
      return res.data;
    },
    enabled: !!listId,
  });
}

export function useCreateTodoList() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string; icon?: string; isShared?: boolean }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/todo-lists`,
        data
      );
      return res.data as TodoList;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", workspace.id] });
    },
  });
}

export function useUpdateTodoList() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: { name?: string; color?: string; icon?: string; isShared?: boolean } }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/todo-lists/${listId}`,
        data
      );
      return res.data as TodoList;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", workspace.id] });
    },
  });
}

export function useDeleteTodoList() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (listId: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/todo-lists/${listId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", workspace.id] });
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      listId,
      data,
    }: {
      listId: string;
      data: {
        title: string;
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
        doDate?: string;
        assigneeId?: string;
      };
    }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/todos`,
        { ...data, listId }
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      listId,
      todoId,
      data,
    }: {
      listId: string;
      todoId: string;
      data: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string;
        doDate?: string;
        assigneeId?: string;
      };
    }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/todos/${todoId}`,
        data
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ listId, todoId }: { listId: string; todoId: string }) => {
      await apiClient.delete(
        `/workspaces/${workspace.id}/todos/${todoId}`
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", workspace.id, variables.listId],
      });
    },
  });
}
