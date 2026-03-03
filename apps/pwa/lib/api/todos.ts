import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { workspacePath } from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { TodoList, Todo } from "@repo/core/types";

export function useTodoLists() {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<TodoList[]>({
    queryKey: ["todoLists", activeWorkspaceId],
    queryFn: async () => {
      const res = await apiClient.get(
        workspacePath("/todo-lists")
      );
      return res.data?.data ?? res.data;
    },
    enabled: !!activeWorkspaceId,
  });
}

export function useTodoList(listId: string) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<TodoList>({
    queryKey: ["todoList", activeWorkspaceId, listId],
    queryFn: async () => {
      const res = await apiClient.get(
        workspacePath(`/todo-lists/${listId}`)
      );
      return res.data;
    },
    enabled: !!activeWorkspaceId && !!listId,
  });
}

export function useTodos(listId: string) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<Todo[]>({
    queryKey: ["todos", activeWorkspaceId, listId],
    queryFn: async () => {
      const res = await apiClient.get(
        workspacePath(`/todo-lists/${listId}/todos`)
      );
      return res.data;
    },
    enabled: !!activeWorkspaceId && !!listId,
  });
}

export function useCreateTodoList() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string; icon?: string; isShared?: boolean }) => {
      const res = await apiClient.post(
        workspacePath("/todo-lists"),
        data
      );
      return res.data as TodoList;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", activeWorkspaceId] });
    },
  });
}

export function useUpdateTodoList() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: { name?: string; color?: string; icon?: string; isShared?: boolean } }) => {
      const res = await apiClient.patch(
        workspacePath(`/todo-lists/${listId}`),
        data
      );
      return res.data as TodoList;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", activeWorkspaceId] });
    },
  });
}

export function useDeleteTodoList() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (listId: string) => {
      await apiClient.delete(workspacePath(`/todo-lists/${listId}`));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["todoLists", activeWorkspaceId] });
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

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
        assigneeId?: string;
      };
    }) => {
      const res = await apiClient.post(
        workspacePath(`/todo-lists/${listId}/todos`),
        data
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", activeWorkspaceId, variables.listId],
      });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

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
        assigneeId?: string;
      };
    }) => {
      const res = await apiClient.patch(
        workspacePath(`/todo-lists/${listId}/todos/${todoId}`),
        data
      );
      return res.data as Todo;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", activeWorkspaceId, variables.listId],
      });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async ({ listId, todoId }: { listId: string; todoId: string }) => {
      await apiClient.delete(
        workspacePath(`/todo-lists/${listId}/todos/${todoId}`)
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["todos", activeWorkspaceId, variables.listId],
      });
    },
  });
}
