import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Target } from "lucide-react";
import {
  Button,
  DatePicker,
  EmptyState,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useHabits } from "@/lib/api/habits";
import { HabitCard } from "@/components/habits/habit-card";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { parseDateLocal } from "@/lib/date";
import type { Habit } from "@repo/core/types";

export const Route = createFileRoute("/_app/habits/")({
  component: HabitsPage,
});

function HabitsPage() {
  const { data: habits, isLoading } = useHabits();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isViewingToday = selectedDate === todayStr;

  return (
    <YStack gap="$6" p="$4">
      {/* Header — the date filter (left) sits on the same row as New Habit
          (right). No page title; the app bar already reads "Habits". */}
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <XStack items="center" gap="$3" flexWrap="wrap">
          <DatePicker
            value={selectedDate ? parseDateLocal(selectedDate) : null}
            onChange={(d) =>
              setSelectedDate(d ? format(d, "yyyy-MM-dd") : todayStr)
            }
            placeholder="Select date"
            isDateDisabled={(d) => d > new Date()}
          />
          {!isViewingToday && (
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setSelectedDate(todayStr)}
            >
              Back to today
            </Button>
          )}
          {!isViewingToday && (
            <Text fontSize="$1" color="$mutedForeground">
              Viewing:{" "}
              {format(
                new Date(selectedDate + "T00:00:00"),
                "EEEE, MMM d, yyyy",
              )}
            </Text>
          )}
        </XStack>
        <Button
          borderWidth={0}
          color={"#ffffff" as never}
          icon={<Plus size={16} color="#ffffff" />}
          style={{ backgroundColor: "var(--ring-habit)" }}
          hoverStyle={
            { backgroundColor: "var(--ring-habit)", opacity: 0.9 } as never
          }
          pressStyle={
            {
              backgroundColor: "var(--ring-habit)",
              opacity: 0.82,
              scale: 0.96,
            } as never
          }
          onPress={() => setShowCreateDialog(true)}
        >
          New Habit
        </Button>
      </XStack>

      {isLoading ? (
        // Responsive grid: 1 col mobile, 2 col tablet (≥ $md), 3 col
        // desktop (≥ $lg). Cards have an explicit width per breakpoint
        // rather than `flex={1}` so they DON'T stretch to fill the row —
        // a single card sits in the top-left at its natural column width
        // (and the right two slots stay empty), matching how the cards
        // would lay out if more were present.
        <XStack flexWrap="wrap" gap="$4">
          {[1, 2, 3].map((i) => (
            <YStack
              key={i}
              width="100%"
              $md={{ width: "49%" }}
              $lg={{ width: "32%" }}
              rounded="$6"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$card"
              p="$5"
            >
              <XStack items="center" gap="$3">
                {/* allowlist: animate-pulse keyframe (Tailwind/globals) */}
                <View
                  height={40}
                  width={40}
                  rounded="$lg"
                  bg="$muted"
                  className="animate-pulse"
                />
                <YStack gap="$2">
                  <View
                    height={16}
                    width={96}
                    rounded="$sm"
                    bg="$muted"
                    className="animate-pulse"
                  />
                  <View
                    height={13}
                    width={128}
                    rounded="$sm"
                    bg="$muted"
                    className="animate-pulse"
                  />
                </YStack>
              </XStack>
              <YStack mt="$4" gap="$2">
                <View
                  height={8}
                  width="100%"
                  rounded={9999}
                  bg="$muted"
                  className="animate-pulse"
                />
              </YStack>
              <XStack mt="$3" justify="space-between">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <YStack key={d} items="center" gap="$1">
                    <View
                      height={10}
                      width={10}
                      rounded="$sm"
                      bg="$muted"
                      className="animate-pulse"
                    />
                    <View
                      height={14}
                      width={14}
                      rounded={9999}
                      bg="$muted"
                      className="animate-pulse"
                    />
                  </YStack>
                ))}
              </XStack>
              <XStack mt="$4" items="center" justify="space-between">
                <View
                  height={13}
                  width={64}
                  rounded="$sm"
                  bg="$muted"
                  className="animate-pulse"
                />
                <View
                  height={28}
                  width={64}
                  rounded="$lg"
                  bg="$muted"
                  className="animate-pulse"
                />
              </XStack>
            </YStack>
          ))}
        </XStack>
      ) : habits && habits.length > 0 ? (
        // Responsive grid: 1 col mobile, 2 col tablet (≥ $md), 3 col
        // desktop (≥ $lg). Each card is wrapped in a sized View — the
        // HabitCard view itself stays platform-agnostic (its only layout
        // hints are `flex` + `minW`), and the host owns the column
        // strategy. `flex={1}` inside the View makes the card fill its
        // assigned column; without it the card would size to its content
        // and leave whitespace inside each column.
        <XStack flexWrap="wrap" gap="$4">
          {habits.map((habit: Habit) => (
            <View
              key={habit.id}
              width="100%"
              $md={{ width: "49%" }}
              $lg={{ width: "32%" }}
            >
              <HabitCard
                habit={habit}
                flex={1}
                minW={0}
                selectedDate={isViewingToday ? undefined : selectedDate}
              />
            </View>
          ))}
        </XStack>
      ) : (
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>No habits yet</EmptyState.Title>
          <EmptyState.Description>
            Create one to start tracking your progress.
          </EmptyState.Description>
        </EmptyState>
      )}

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </YStack>
  );
}
