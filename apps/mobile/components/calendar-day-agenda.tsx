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

import {
  ActivityRings,
  Button,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { activityRingsConfig } from "@repo/features/activity-rings";
import { scheduledHabitsForDate } from "@repo/core/habits/entry-resolution";
import type { Habit } from "@repo/core/types";
import { Check, Plus } from "@tamagui/lucide-icons-2";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRouter } from "expo-router";

import {
  computeActivityRings,
  countScheduledHabits,
  type CalendarDayData,
} from "@/lib/api/hooks/calendar";
import { useToggleTodo } from "@/lib/api";
import { HabitCheckInRow } from "./habit-check-in-row";
import { IGNITION } from "@/lib/ignition-palette";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

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
  const qc = useQueryClient();
  const toggleTodo = useToggleTodo();

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

  function handleToggle(todo: { id: string; status: string }) {
    toggleTodo.mutate(
      { id: todo.id, status: todo.status as "todo" | "done" },
      {
        // The calendar dataset is its own aggregation — refresh it so the
        // agenda + cell rings reflect the flip.
        onSettled: () => void qc.invalidateQueries({ queryKey: ["calendar"] }),
      },
    );
  }

  // The habits scheduled on the selected day — rendered as INTERACTIVE
  // check-in rows (parity with the PWA agenda's date-scoped HabitListItem),
  // not just the day's existing entries as read-only chips. Non-day quota
  // (weekly_target) habits are excluded, matching the PWA.
  const dateStr = format(date, "yyyy-MM-dd");
  const scheduledHabits = scheduledHabitsForDate(habits, dateStr);

  const hasAnything =
    dayData.todos.length > 0 ||
    scheduledHabits.length > 0 ||
    dayData.journals.length > 0;

  return (
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

      {/* Todos — toggleable rows. */}
      {dayData.todos.length > 0 ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
            TODOS
          </Text>
          {dayData.todos.map((todo) => {
            const done = todo.status === "done";
            return (
              <XStack
                key={todo.id}
                items="center"
                gap="$2.5"
                py="$1"
                onPress={() => handleToggle(todo)}
                pressStyle={{ opacity: 0.7 }}
              >
                <View
                  width={18}
                  height={18}
                  rounded={9999}
                  borderWidth={1.5}
                  borderColor={done ? IGNITION.todo.base : "$borderColor"}
                  bg={done ? IGNITION.todo.base : "transparent"}
                  items="center"
                  justify="center"
                >
                  {done ? <Check size={11} color="#ffffff" /> : null}
                </View>
                <Text
                  flex={1}
                  minW={0}
                  fontSize="$3"
                  color={done ? "$mutedForeground" : "$color"}
                  textDecorationLine={done ? "line-through" : "none"}
                  numberOfLines={1}
                >
                  {todo.title}
                </Text>
                {PRIORITY_COLOR[todo.priority] ? (
                  <View
                    width={8}
                    height={8}
                    rounded={9999}
                    bg={PRIORITY_COLOR[todo.priority] as never}
                  />
                ) : null}
              </XStack>
            );
          })}
        </YStack>
      ) : null}

      {/* Habits scheduled this day — interactive check-in rows (check in /
          skip / fail / undo for the SELECTED date, not just today). */}
      {scheduledHabits.length > 0 ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
            HABITS
          </Text>
          {scheduledHabits.map((habit) => (
            <HabitCheckInRow
              key={habit.id}
              habit={habit}
              activeDate={dateStr}
              onOpenDetail={() => router.push(`/habits/${habit.id}`)}
            />
          ))}
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
  );
}
