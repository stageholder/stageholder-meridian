import { useState } from "react";
import { format, isToday as isTodayFn } from "date-fns";
import { Plus, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ActivityRings,
  Button,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useUpdateTodo, useTodoLists, useAllTodos } from "@/lib/api/todos";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { TodoDetailDialog } from "@/components/todos/todo-detail-dialog";
import {
  computeActivityRings,
  activityRingsConfig,
} from "@/lib/hooks/use-activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

// Priority pill intent tokens — urgent→destructive, high/medium→warning, low→primary.
const priorityConfig = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
  none: { label: "", bg: "$muted", color: "$mutedForeground" },
} as const;

function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter(
    (h) => !h.scheduledDays?.length || h.scheduledDays.includes(dow),
  ).length;
}

function SectionHeader({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <XStack items="center" gap="$2">
      <View
        width={8}
        height={8}
        rounded={9999}
        style={{ backgroundColor: color }}
      />
      <Text
        fontSize="$1"
        fontWeight="600"
        color="$mutedForeground"
        textTransform="uppercase"
        letterSpacing={0.5}
      >
        {label} ({count})
      </Text>
    </XStack>
  );
}

interface DayAgendaProps {
  date: Date;
  dayData: CalendarDayData;
  habits: Habit[];
}

export function DayAgenda({ date, dayData, habits }: DayAgendaProps) {
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
  const isToday = isTodayFn(date);

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
        onSuccess: () =>
          void queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      },
    );
  }

  return (
    <>
      <YStack gap="$4">
        {/* Header — date + activity ring */}
        <XStack items="center" gap="$3">
          <ActivityRings
            rings={activityRingsConfig(
              computeActivityRings(dayData, countScheduledHabits(habits, date)),
            )}
            size={48}
            thickness={5}
            gap={3}
          />
          <YStack flex={1} minW={0}>
            <Text fontSize="$7" fontWeight="700" color="$color">
              {isToday ? "Today" : format(date, "EEEE")}
            </Text>
            <Text fontSize="$2" color="$mutedForeground">
              {format(date, "MMMM d, yyyy")}
            </Text>
          </YStack>
        </XStack>

        {/* Create actions — category-colored: todo = red, journal = yellow.
              The kit has no todo/journal intent, so we force the ring color via
              inline bg (wins in every state) with readable ink (white on red,
              dark on the lighter yellow). */}
        <XStack gap="$2">
          <Button
            flex={1}
            size="sm"
            borderWidth={0}
            color={"#ffffff" as never}
            icon={<Plus size={15} color="#ffffff" />}
            style={{ backgroundColor: "var(--ring-todo)" }}
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.82, scale: 0.96 }}
            onPress={() => setShowCreateTodo(true)}
          >
            Add Todo
          </Button>
          <Button
            flex={1}
            intent="outline"
            size="sm"
            color={"var(--ring-journal)" as never}
            borderColor={"var(--ring-journal)" as never}
            icon={<BookOpen size={15} color="var(--ring-journal)" />}
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.82, scale: 0.96 }}
            onPress={() =>
              void navigate({ to: "/journal/new", search: { date: dateStr } })
            }
          >
            New Journal
          </Button>
        </XStack>

        <Separator />

        {/* Todos */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-todo)"
            label="Todos"
            count={dayData.todos.length}
          />
          {dayData.todos.length > 0 ? (
            <YStack gap="$1">
              {dayData.todos.map((todo) => {
                const isDone = todo.status === "done";
                const priority =
                  priorityConfig[
                    todo.priority as keyof typeof priorityConfig
                  ] ?? priorityConfig.none;
                return (
                  <XStack
                    key={todo.id}
                    onPress={() => setDetailTodoId(todo.id)}
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
                      numberOfLines={2}
                      color={isDone ? "$mutedForeground" : "$color"}
                      textDecorationLine={isDone ? "line-through" : "none"}
                    >
                      {todo.title}
                    </Text>
                    {priority.label ? (
                      <Text
                        shrink={0}
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
                    ) : null}
                  </XStack>
                );
              })}
            </YStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              Nothing due
            </Text>
          )}
        </YStack>

        {/* Habits */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-habit)"
            label="Habits"
            count={dayData.habitEntries.length}
          />
          {dayData.habitEntries.length > 0 ? (
            <XStack flexWrap="wrap" gap="$2">
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
                    borderColor={isSkip ? "$mutedForeground" : undefined}
                    bg={
                      isFail
                        ? "$destructiveMuted"
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
                          : done
                            ? "$success"
                            : "$mutedForeground"
                      }
                    >
                      {isFail ? "✕" : isSkip ? "Skipped" : done ? "✓" : "✗"}{" "}
                      {entry.habitName}
                    </Text>
                  </XStack>
                );
              })}
            </XStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              No habit entries
            </Text>
          )}
        </YStack>

        {/* Journal */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-journal)"
            label="Journal"
            count={dayData.journals.length}
          />
          {dayData.journals.length > 0 ? (
            <YStack gap="$1">
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
                    numberOfLines={1}
                    hoverStyle={{ bg: "$accent" }}
                  >
                    {journal.title || "Untitled entry"}
                  </Text>
                </Link>
              ))}
            </YStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              No journal entries
            </Text>
          )}
        </YStack>
      </YStack>

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
