import { useState } from "react";
import { format, isToday as isTodayFn } from "date-fns";
import { Plus, BookOpen } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ActivityRings,
  AnimatePresence,
  Button,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useTodoLists, useAllTodos } from "@/lib/api/todos";
import { TodoItem } from "@/components/todos/todo-item";
import { HabitListItem } from "@/components/habits/habit-list-item";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import {
  computeActivityRings,
  activityRingsConfig,
} from "@/lib/hooks/use-activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit, Todo } from "@repo/core/types";

// Quota (`weekly_target`) habits aren't day-scheduled, so they're excluded
// from the per-day habit-ring denominator + the day's actionable habit list.
function scheduledDayHabits(habits: Habit[], date: Date): Habit[] {
  const dow = date.getDay();
  return habits.filter(
    (h) =>
      h.frequency !== "weekly_target" &&
      (!h.scheduledDays?.length || h.scheduledDays.includes(dow)),
  );
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
  const { data: lists } = useTodoLists();
  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const { data: allTodos } = useAllTodos();

  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = isTodayFn(date);

  const scheduledHabits = scheduledDayHabits(habits, date);

  // The calendar day payload carries only a slim todo shape; the real
  // `TodoItem` needs the full `Todo`, so resolve each against `allTodos`. The
  // real item + its mutations invalidate `["calendar"]`, so completing a todo
  // (with its burn) refreshes this panel's rings automatically.
  const dayTodos = dayData.todos
    .map((t) => allTodos?.find((a) => a.id === t.id))
    .filter((t): t is Todo => !!t);

  return (
    <>
      <YStack gap="$4">
        {/* Header — date + activity ring */}
        <XStack items="center" gap="$3">
          <ActivityRings
            rings={activityRingsConfig(
              computeActivityRings(
                dayData,
                scheduledHabits.length,
                undefined,
                new Set(
                  habits
                    .filter((h) => h.frequency === "weekly_target")
                    .map((h) => h.id),
                ),
              ),
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
            hoverStyle={
              { backgroundColor: "var(--ring-todo)", opacity: 0.9 } as never
            }
            pressStyle={
              {
                backgroundColor: "var(--ring-todo)",
                opacity: 0.82,
                scale: 0.96,
              } as never
            }
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

        {/* Todos — the real `TodoItem` (checkbox + burn, actions menu, detail
            dialog), compact. */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-todo)"
            label="Todos"
            count={dayData.todos.length}
          />
          {dayTodos.length > 0 ? (
            <YStack gap="$2">
              <AnimatePresence>
                {dayTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    listId={todo.listId}
                    showList
                    compact
                  />
                ))}
              </AnimatePresence>
            </YStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              Nothing due
            </Text>
          )}
        </YStack>

        {/* Habits — the real `HabitListItem` list-view row (icon · name ·
            week-dot streak strip · check-in / status · skip/fail/undo menu),
            scoped to THIS day via `selectedDate`. */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-habit)"
            label="Habits"
            count={scheduledHabits.length}
          />
          {scheduledHabits.length > 0 ? (
            <YStack gap="$2">
              {scheduledHabits.map((habit) => (
                <HabitListItem
                  key={habit.id}
                  habit={habit}
                  selectedDate={dateStr}
                />
              ))}
            </YStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              No habits scheduled
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
    </>
  );
}
