// apps/mobile/components/calendar-day-agenda.tsx
//
// Day agenda for the Calendar screen — condensed native port of the PWA's
// DayAgenda (apps/pwa/src/components/calendar/day-agenda.tsx): the selected
// day's todos (toggleable), habit entries (status chips), and journal
// entries (tap → entry), with the day's activity rings in the header and
// create affordances.
//
// Toggling a todo PATCHes via useToggleTodo, then ALSO invalidates the
// ["calendar"] month caches — the calendar dataset is a separate
// aggregation the todo hooks don't know about.

import { useState } from "react";
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
import { activityRingsConfig } from "@repo/features/activity-rings";
import { TodoItem } from "@repo/features/todos";
import { CollapsibleGroup, splitHabitsByDay } from "@repo/features/calendar";
import { scheduledHabitsForDate } from "@repo/core/habits/entry-resolution";
import type { Habit, Todo } from "@repo/core/types";
import { Plus } from "@tamagui/lucide-icons-2";
import { format } from "date-fns";
import { useRouter } from "expo-router";

import {
  computeActivityRings,
  countScheduledHabits,
  type CalendarDayData,
} from "@/lib/api/hooks/calendar";
import { useDeleteTodo, useToggleTodo, useTodos } from "@/lib/api";
import { EditTodoDialog } from "@/components/edit-todo-dialog";
import { HabitCheckInRow } from "./habit-check-in-row";
import { IGNITION } from "@/lib/ignition-palette";

export function CalendarDayAgenda({
  date,
  dayData,
  habits,
  onAddTodo,
}: {
  date: Date;
  dayData: CalendarDayData;
  habits: Habit[];
  /** Opens the create-todo sheet (host owns the dialog). */
  onAddTodo: () => void;
}) {
  const router = useRouter();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  // Resolve the calendar's slim todo shape into FULL `Todo` objects (like the
  // PWA agenda) so we can render the real shared `TodoItem` — not a
  // hand-rolled checkbox. This also fixes the "toggle doesn't work" bug: the
  // full todo carries LIVE status from the todos cache, while the calendar
  // `dayData.todos` status could be stale between refetches.
  const { data: allTodos } = useTodos();
  const [editing, setEditing] = useState<Todo | null>(null);

  const dayTodos = dayData.todos
    .map((t) => allTodos?.find((a) => a.id === t.id))
    .filter((t): t is Todo => !!t);
  // Split like the PWA agenda: pending shown, finished tucked in a collapsible.
  const activeTodos = dayTodos.filter((t) => t.status !== "done");
  const completedTodos = dayTodos.filter((t) => t.status === "done");

  const quotaIds = new Set(
    habits.filter((h) => h.frequency === "weekly_target").map((h) => h.id),
  );
  const rings = activityRingsConfig(
    computeActivityRings(
      dayData,
      countScheduledHabits(habits, date),
      undefined,
      quotaIds,
    ),
  );

  // The habits scheduled on the selected day — rendered as INTERACTIVE
  // check-in rows (parity with the PWA agenda's date-scoped HabitListItem),
  // not just the day's existing entries as read-only chips. Non-day quota
  // (weekly_target) habits are excluded, matching the PWA.
  const dateStr = format(date, "yyyy-MM-dd");
  const scheduledHabits = scheduledHabitsForDate(habits, dateStr);
  // Split like the PWA: pending habits shown, done/skipped/failed collapsed.
  const { pending: pendingHabits, done: doneHabits } = splitHabitsByDay(
    scheduledHabits,
    dayData.habitEntries,
  );

  const hasAnything =
    dayData.todos.length > 0 ||
    scheduledHabits.length > 0 ||
    dayData.journals.length > 0;

  return (
    <>
      <YStack gap="$3">
        {/* Header — date + the day's rings. */}
        <XStack items="center" justify="space-between" gap="$3">
          <YStack flex={1} minW={0}>
            <Text fontSize="$5" fontWeight="700" color="$color">
              {format(date, "EEEE, MMM d")}
            </Text>
            <Text fontSize="$1" color="$mutedForeground">
              {dayData.todos.length} todos · {dayData.habitEntries.length} habit
              check-ins · {dayData.journals.length} journal
            </Text>
          </YStack>
          <ActivityRings rings={rings} size={56} thickness={5} gap={2} />
        </XStack>

        {/* Create affordances — same pair as the PWA agenda. */}
        <XStack gap="$2">
          <Button
            intent="outline"
            size="sm"
            flex={1}
            icon={<Plus size={14} color={IGNITION.todo.base as never} />}
            onPress={onAddTodo}
          >
            Add todo
          </Button>
          <Button
            intent="outline"
            size="sm"
            flex={1}
            icon={<Plus size={14} color={IGNITION.journal.base as never} />}
            // Seed the tapped day so a journal added from the calendar is dated
            // that day (PWA agenda parity), not silently dated today — critical
            // for backfilling a missed past day. journal/new reads `date`.
            onPress={() =>
              router.push({
                pathname: "/journal/new",
                params: { date: format(date, "yyyy-MM-dd") },
              })
            }
          >
            New journal
          </Button>
        </XStack>

        {!hasAnything ? (
          <Text fontSize="$2" color="$mutedForeground" py="$2">
            Nothing scheduled this day.
          </Text>
        ) : null}

        {/* Todos — the REAL shared `TodoItem` (checkbox + burn + meta badges +
          tap-to-edit), compact, exactly like the PWA agenda: pending shown,
          completed tucked in a collapsible group. */}
        {dayTodos.length > 0 ? (
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
              TODOS
            </Text>
            {activeTodos.length > 0 ? (
              <YStack gap="$2">
                <AnimatePresence>
                  {activeTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      compact
                      onToggle={() =>
                        toggleTodo.mutate({ id: todo.id, status: todo.status })
                      }
                      onDelete={() => deleteTodo.mutate(todo.id)}
                      onOpenDetail={() => setEditing(todo)}
                    />
                  ))}
                </AnimatePresence>
              </YStack>
            ) : null}
            <CollapsibleGroup label="Completed" count={completedTodos.length}>
              {completedTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  compact
                  onToggle={() =>
                    toggleTodo.mutate({ id: todo.id, status: todo.status })
                  }
                  onDelete={() => deleteTodo.mutate(todo.id)}
                  onOpenDetail={() => setEditing(todo)}
                />
              ))}
            </CollapsibleGroup>
          </YStack>
        ) : null}

        {/* Habits scheduled this day — interactive check-in rows for the
          SELECTED date; pending shown, resolved (done/skipped/failed) tucked
          in a collapsible group, exactly like the PWA agenda. */}
        {scheduledHabits.length > 0 ? (
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
              HABITS
            </Text>
            {pendingHabits.map((habit) => (
              <HabitCheckInRow
                key={habit.id}
                habit={habit}
                activeDate={dateStr}
                onOpenDetail={() => router.push(`/habits/${habit.id}`)}
              />
            ))}
            <CollapsibleGroup label="Done" count={doneHabits.length}>
              {doneHabits.map((habit) => (
                <HabitCheckInRow
                  key={habit.id}
                  habit={habit}
                  activeDate={dateStr}
                  onOpenDetail={() => router.push(`/habits/${habit.id}`)}
                />
              ))}
            </CollapsibleGroup>
          </YStack>
        ) : null}

        {/* Journal entries — tap to open. */}
        {dayData.journals.length > 0 ? (
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
              JOURNAL
            </Text>
            {dayData.journals.map((j) => (
              <XStack
                key={j.id}
                items="center"
                gap="$2.5"
                py="$1"
                onPress={() => router.push(`/journal/${j.id}`)}
                pressStyle={{ opacity: 0.7 }}
              >
                <View
                  width={8}
                  height={8}
                  rounded={9999}
                  bg={IGNITION.journal.base as never}
                />
                <Text flex={1} fontSize="$3" color="$color" numberOfLines={1}>
                  {j.title || "Journal entry"}
                </Text>
                {j.wordCount > 0 ? (
                  <Text fontSize="$1" color="$mutedForeground">
                    {j.wordCount} words
                  </Text>
                ) : null}
              </XStack>
            ))}
            <Separator />
          </YStack>
        ) : null}
      </YStack>

      {/* Tap a todo → the shared edit sheet (same as the todos screen). */}
      <EditTodoDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        todo={editing}
      />
    </>
  );
}
