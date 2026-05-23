import { format } from "date-fns";
import { Sun } from "lucide-react";
import { AnimatePresence, Text, XStack, YStack } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { CompletedSection } from "./completed-section";
import { TodoListSkeleton } from "./todo-list-skeleton";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo } from "@repo/core/types";

export function TodayContent() {
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

  const today = format(new Date(), "yyyy-MM-dd");

  const dueByToday = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due <= today) || (!!doDate && doDate <= today);
  });

  const isOverdue = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due < today) || (!!doDate && doDate < today);
  };

  const overdue = dueByToday.filter(isOverdue);
  const dueToday = dueByToday.filter((t) => !isOverdue(t));

  // Todos finished today (the satisfying "look what I got done" group).
  const completedToday = (todos || []).filter(
    (t: Todo) =>
      t.status === "done" &&
      format(new Date(t.updatedAt), "yyyy-MM-dd") === today,
  );

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  const section = (label: string, color: string, items: Todo[]) =>
    items.length === 0 ? null : (
      <YStack gap="$0.5">
        <XStack mb="$1.5" items="center" gap="$2">
          <Text
            fontSize="$1"
            fontWeight="700"
            color={color}
            textTransform="uppercase"
            letterSpacing={0.6}
          >
            {label}
          </Text>
          <Text fontSize="$1" color="$mutedForeground">
            {items.length}
          </Text>
        </XStack>
        <AnimatePresence>
          {items.map((todo) => (
            <TodoItem key={todo.id} todo={todo} listId={todo.listId} />
          ))}
        </AnimatePresence>
      </YStack>
    );

  return (
    <>
      <XStack mb="$6" items="center" gap="$3">
        <Text color="$mutedForeground" lineHeight={0}>
          <Sun size={24} />
        </Text>
        <YStack>
          <Text fontSize="$7" fontWeight="700" color="$color">
            Today
          </Text>
          <Text mt="$1" fontSize="$3" color="$mutedForeground">
            {dueByToday.length} due today or overdue
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
        <YStack mt="$4" gap="$6">
          {dueByToday.length === 0 ? (
            <YStack py="$8" items="center">
              <Text fontSize="$3" color="$mutedForeground" text="center">
                Nothing due today. You&apos;re all caught up!
              </Text>
            </YStack>
          ) : (
            <>
              {section("Overdue", "$destructive", overdue)}
              {section("Today", "$mutedForeground", dueToday)}
            </>
          )}
          <CompletedSection todos={completedToday} />
        </YStack>
      )}
    </>
  );
}
