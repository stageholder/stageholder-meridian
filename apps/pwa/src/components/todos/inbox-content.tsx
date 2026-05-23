import { Inbox } from "lucide-react";
import {
  AnimatePresence,
  EmptyState,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { CompletedSection } from "./completed-section";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import { TodoListSkeleton } from "./todo-list-skeleton";
import type { Todo, TodoList } from "@repo/core/types";

export function InboxContent() {
  const {
    data: todos,
    isLoading: todosLoading,
    isError: todosError,
  } = useAllTodos();
  const {
    data: lists,
    isLoading: listsLoading,
    isError: listsError,
  } = useTodoLists();

  const isLoading = todosLoading || listsLoading;
  const isError = todosError || listsError;

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const pendingTodos = (todos || []).filter((t) => t.status !== "done");
  const completedTodos = (todos || []).filter((t) => t.status === "done");

  // Group pending todos by list
  const groupedByList = new Map<string, Todo[]>();
  for (const todo of pendingTodos) {
    const group = groupedByList.get(todo.listId) || [];
    group.push(todo);
    groupedByList.set(todo.listId, group);
  }

  // Sort groups: default list first, then alphabetical
  const sortedListIds = [...groupedByList.keys()].sort((a, b) => {
    const listA = listMap.get(a);
    const listB = listMap.get(b);
    if (listA?.isDefault) return -1;
    if (listB?.isDefault) return 1;
    return (listA?.name || "").localeCompare(listB?.name || "");
  });

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <XStack mb="$6" items="center" gap="$3">
        <Text color="$mutedForeground" lineHeight={0}>
          <Inbox size={24} />
        </Text>
        <YStack>
          <Text fontSize="$7" fontWeight="700" color="$color">
            Inbox
          </Text>
          <Text mt="$1" fontSize="$3" color="$mutedForeground">
            {pendingTodos.length} todo{pendingTodos.length !== 1 ? "s" : ""}
          </Text>
        </YStack>
      </XStack>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <TodoListSkeleton />
      ) : isError ? (
        <Text mt="$3" fontSize="$3" color="$destructive">
          Failed to load todos. Please try refreshing the page.
        </Text>
      ) : (
        <YStack mt="$3" gap="$6">
          {sortedListIds.map((listId) => {
            const list = listMap.get(listId);
            const listTodos = groupedByList.get(listId) || [];
            return (
              <YStack key={listId}>
                <XStack mb="$2" items="center" gap="$2">
                  <View
                    width={12}
                    height={12}
                    rounded={9999}
                    style={{ backgroundColor: list?.color || "#6b7280" }}
                  />
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    {list?.name || "Unknown List"}
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    ({listTodos.length})
                  </Text>
                </XStack>
                <YStack gap="$0.5">
                  <AnimatePresence>
                    {listTodos.map((todo) => (
                      <TodoItem key={todo.id} todo={todo} listId={listId} />
                    ))}
                  </AnimatePresence>
                </YStack>
              </YStack>
            );
          })}

          {pendingTodos.length === 0 && completedTodos.length === 0 && (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text color="$mutedForeground">
                  <Inbox size={20} />
                </Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>Inbox is clear</EmptyState.Title>
              <EmptyState.Description>
                Add a todo above to get started.
              </EmptyState.Description>
            </EmptyState>
          )}

          <CompletedSection todos={completedTodos} />
        </YStack>
      )}
    </>
  );
}
