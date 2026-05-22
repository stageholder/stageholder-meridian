import { useState } from "react";
import { format } from "date-fns";
import { Plus, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, H3, Text, View, XStack, YStack } from "@stageholder/ui";
import { useUpdateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { TodoDetailDialog } from "@/components/todos/todo-detail-dialog";
import type { CalendarDayData } from "@/lib/api/calendar";
import { ActivityRingsVisual } from "@/components/activity-rings";
import { computeActivityRings } from "@/components/activity-rings";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Habit, Todo } from "@repo/core/types";
import { useAllTodos } from "@/lib/api/todos";

// Priority pill intent tokens — same mapping as todo-item.tsx:
// urgent→destructive, high/medium→warning (amber), low→primary (azure).
// `as const` keeps the values as literal token strings so they satisfy
// Tamagui's strict color-prop typing (arbitrary `string` is rejected).
const priorityConfig = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
  none: { label: "", bg: "$muted", color: "$mutedForeground" },
} as const;

function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter((h) => {
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

interface DayPanelProps {
  date: Date;
  dayData: CalendarDayData;
  habits: Habit[];
}

export function DayPanel({ date, dayData, habits }: DayPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateTodo = useUpdateTodo();
  const { data: lists } = useTodoLists();
  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [detailTodoId, setDetailTodoId] = useState<string | null>(null);
  const { data: allTodos } = useAllTodos();
  const detailTodo = detailTodoId
    ? allTodos?.find((t) => t.id === detailTodoId)
    : undefined;

  const dateStr = format(date, "yyyy-MM-dd");

  function handleOpenTodo(todoId: string) {
    setDetailTodoId(todoId);
  }

  function handleToggleTodo(
    todoId: string,
    listId: string,
    currentStatus: string,
  ) {
    updateTodo.mutate(
      {
        listId,
        todoId,
        data: { status: currentStatus === "done" ? "todo" : "done" },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
      },
    );
  }

  return (
    <>
      <Card>
        <Card.Body p="$5" gap="$4">
          <XStack items="center" gap="$3">
            <ActivityRingsVisual
              data={computeActivityRings(
                dayData,
                countScheduledHabits(habits, date),
              )}
              size="md"
            />
            <H3 fontSize="$3" fontWeight="600" color="$color">
              {format(date, "EEEE, MMMM d, yyyy")}
            </H3>
          </XStack>

          {/* Todos Section */}
          <YStack>
            <XStack items="center" gap="$2">
              <View width={8} height={8} rounded={9999} bg="$primary" />
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Todos ({dayData.todos.length})
              </Text>
            </XStack>
            {dayData.todos.length > 0 ? (
              <YStack mt="$2" gap="$1.5">
                {dayData.todos.map((todo) => {
                  const isDone = todo.status === "done";
                  const priority =
                    priorityConfig[
                      todo.priority as keyof typeof priorityConfig
                    ] ?? priorityConfig.none;
                  return (
                    <XStack
                      key={todo.id}
                      onPress={() => handleOpenTodo(todo.id)}
                      cursor="pointer"
                      items="center"
                      gap="$2"
                      rounded="$md"
                      px="$2"
                      py="$1.5"
                      hoverStyle={{ bg: "$accent" }}
                    >
                      <View
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleTodo(todo.id, todo.listId, todo.status);
                        }}
                        width={16}
                        height={16}
                        shrink={0}
                        items="center"
                        justify="center"
                        rounded={9999}
                        borderWidth={2}
                        transition="quick"
                        borderColor={isDone ? "$primary" : "$mutedForeground"}
                        bg={isDone ? "$primary" : "transparent"}
                        hoverStyle={
                          isDone ? undefined : { borderColor: "$primary" }
                        }
                      >
                        {isDone && (
                          <Text color="$primaryForeground" lineHeight={0}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </Text>
                        )}
                      </View>
                      <Text
                        flex={1}
                        fontSize="$3"
                        color={isDone ? "$mutedForeground" : "$color"}
                        textDecorationLine={isDone ? "line-through" : "none"}
                      >
                        {todo.title}
                      </Text>
                      {priority.label && (
                        <Text
                          bg={priority.bg}
                          color={priority.color}
                          rounded={9999}
                          px="$1.5"
                          py="$0.5"
                          fontSize={10}
                          fontWeight="500"
                        >
                          {priority.label}
                        </Text>
                      )}
                    </XStack>
                  );
                })}
              </YStack>
            ) : (
              <Text mt="$2" fontSize="$1" color="$mutedForeground">
                No todos
              </Text>
            )}
          </YStack>

          {/* Journals Section */}
          <YStack>
            <XStack items="center" gap="$2">
              <View width={8} height={8} rounded={9999} bg="$success" />
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Journal ({dayData.journals.length})
              </Text>
            </XStack>
            {dayData.journals.length > 0 ? (
              <YStack mt="$2" gap="$1.5">
                {dayData.journals.map((journal) => (
                  <Link
                    key={journal.id}
                    to="/journal/$id"
                    params={{ id: journal.id }}
                    style={{ textDecoration: "none" }}
                  >
                    <Text
                      rounded="$md"
                      px="$2"
                      py="$1.5"
                      fontSize="$3"
                      color="$color"
                      hoverStyle={{ bg: "$accent" }}
                    >
                      {journal.title}
                    </Text>
                  </Link>
                ))}
              </YStack>
            ) : (
              <Text mt="$2" fontSize="$1" color="$mutedForeground">
                No journal entries
              </Text>
            )}
          </YStack>

          {/* Habits Section */}
          <YStack>
            <XStack items="center" gap="$2">
              <View width={8} height={8} rounded={9999} bg="$warning" />
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Habits ({dayData.habitEntries.length})
              </Text>
            </XStack>
            {dayData.habitEntries.length > 0 ? (
              <XStack mt="$2" flexWrap="wrap" gap="$2">
                {dayData.habitEntries.map((entry) => {
                  const isSkip = entry.type === "skip";
                  const isFail = entry.type === "fail";
                  const done = !isFail && !isSkip && entry.value > 0;
                  return (
                    <XStack
                      key={entry.id}
                      items="center"
                      gap="$1"
                      rounded={9999}
                      px="$2.5"
                      py="$1"
                      borderWidth={isSkip ? 1 : 0}
                      borderStyle={isSkip ? "dashed" : undefined}
                      borderColor={isSkip ? "$mutedForeground" : undefined}
                      bg={
                        isFail
                          ? "$destructiveMuted"
                          : isSkip
                            ? "$muted"
                            : done
                              ? "$successMuted"
                              : "$muted"
                      }
                    >
                      <Text
                        fontSize="$1"
                        fontWeight="500"
                        color={
                          isFail
                            ? "$destructive"
                            : isSkip
                              ? "$mutedForeground"
                              : done
                                ? "$success"
                                : "$mutedForeground"
                        }
                      >
                        {isFail
                          ? "\u2715"
                          : isSkip
                            ? "Skipped"
                            : done
                              ? "\u2713"
                              : "\u2717"}{" "}
                        {entry.habitName}
                      </Text>
                    </XStack>
                  );
                })}
              </XStack>
            ) : (
              <Text mt="$2" fontSize="$1" color="$mutedForeground">
                No habit entries
              </Text>
            )}
          </YStack>

          {/* Quick Actions */}
          <XStack mt="$1" gap="$2">
            <Button
              intent="outline"
              size="sm"
              icon={<Plus size={14} />}
              onPress={() => setShowCreateTodo(true)}
            >
              Add Todo
            </Button>
            <Button
              intent="outline"
              size="sm"
              icon={<BookOpen size={14} />}
              onPress={() =>
                void navigate({ to: "/journal/new", search: { date: dateStr } })
              }
            >
              New Journal
            </Button>
          </XStack>
        </Card.Body>
      </Card>

      {defaultList && (
        <CreateTodoDialog
          open={showCreateTodo}
          onOpenChange={setShowCreateTodo}
          listId={defaultList.id}
          defaultDueDate={dateStr}
        />
      )}

      {detailTodo && (
        <TodoDetailDialog
          open={!!detailTodo}
          onOpenChange={(open) => {
            if (!open) setDetailTodoId(null);
          }}
          todo={detailTodo}
          listId={detailTodo.listId}
        />
      )}
    </>
  );
}
