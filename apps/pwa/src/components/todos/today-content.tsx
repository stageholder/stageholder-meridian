import { format } from "date-fns";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import { useAnimatedTodoList } from "@/lib/hooks/use-animated-todo-list";
import type { Todo, TodoList } from "@repo/core/types";

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

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const todayTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    const hasDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const hasDoToday = doDateStr !== undefined && doDateStr <= today;
    return hasDueToday || hasDoToday;
  });

  const { visibleTodos, completingIds } = useAnimatedTodoList(todayTodos);

  // Group by list
  const groupedByList = new Map<string, Todo[]>();
  for (const todo of visibleTodos) {
    const group = groupedByList.get(todo.listId) || [];
    group.push(todo);
    groupedByList.set(todo.listId, group);
  }

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
      <YStack mb="$6">
        <Text fontSize="$7" fontWeight="700" color="$color">
          Today
        </Text>
        <Text mt="$1" fontSize="$3" color="$mutedForeground">
          {todayTodos.length} todo{todayTodos.length !== 1 ? "s" : ""} due today
          or overdue
        </Text>
      </YStack>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <Text mt="$3" fontSize="$3" color="$mutedForeground">
          Loading todos...
        </Text>
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
                <YStack gap="$2">
                  {listTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      listId={listId}
                      isCompleting={completingIds.has(todo.id)}
                    />
                  ))}
                </YStack>
              </YStack>
            );
          })}

          {todayTodos.length === 0 && (
            <YStack py="$8" items="center">
              <Text fontSize="$3" color="$mutedForeground" text="center">
                Nothing due today. You&apos;re all caught up!
              </Text>
            </YStack>
          )}
        </YStack>
      )}
    </>
  );
}
