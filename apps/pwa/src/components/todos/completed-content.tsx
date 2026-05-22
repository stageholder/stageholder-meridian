import { Text, View, XStack, YStack } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo, TodoList } from "@repo/core/types";

export function CompletedContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();

  const isLoading = todosLoading || listsLoading;

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const completedTodos = (todos || [])
    .filter((t) => t.status === "done" && new Date(t.updatedAt) >= sevenDaysAgo)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  // Group by date completed
  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of completedTodos) {
    const dateKey = new Date(todo.updatedAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const group = groupedByDate.get(dateKey) || [];
    group.push(todo);
    groupedByDate.set(dateKey, group);
  }

  return (
    <>
      <YStack mb="$6">
        <Text fontSize="$7" fontWeight="700" color="$color">
          Completed
        </Text>
        <Text mt="$1" fontSize="$3" color="$mutedForeground">
          {completedTodos.length} completed in the past 7 days
        </Text>
      </YStack>

      {isLoading ? (
        <Text mt="$3" fontSize="$3" color="$mutedForeground">
          Loading todos...
        </Text>
      ) : (
        <YStack mt="$3" gap="$6">
          {[...groupedByDate.entries()].map(([date, dateTodos]) => {
            // Sub-group by list
            const byList = new Map<string, Todo[]>();
            for (const todo of dateTodos) {
              const group = byList.get(todo.listId) || [];
              group.push(todo);
              byList.set(todo.listId, group);
            }

            return (
              <YStack key={date}>
                <Text mb="$3" fontSize="$3" fontWeight="600" color="$color">
                  {date}
                </Text>
                <YStack gap="$4" pl="$1.5">
                  {[...byList.entries()].map(([listId, listTodos]) => {
                    const list = listMap.get(listId);
                    return (
                      <YStack key={listId}>
                        <XStack mb="$2" items="center" gap="$2">
                          <View
                            width={12}
                            height={12}
                            rounded={9999}
                            style={{
                              backgroundColor: list?.color || "#6b7280",
                            }}
                          />
                          <Text
                            fontSize="$1"
                            fontWeight="500"
                            color="$mutedForeground"
                          >
                            {list?.name || "Unknown List"}
                          </Text>
                        </XStack>
                        <YStack gap="$2">
                          {listTodos.map((todo) => (
                            <TodoItem
                              key={todo.id}
                              todo={todo}
                              listId={listId}
                            />
                          ))}
                        </YStack>
                      </YStack>
                    );
                  })}
                </YStack>
              </YStack>
            );
          })}

          {completedTodos.length === 0 && (
            <YStack py="$8" items="center">
              <Text fontSize="$3" color="$mutedForeground" text="center">
                No completed todos in the past 7 days.
              </Text>
            </YStack>
          )}
        </YStack>
      )}
    </>
  );
}
