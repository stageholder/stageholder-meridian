import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Target } from "lucide-react";
import {
  Button,
  DatePicker,
  EmptyState,
  H1,
  Paragraph,
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
      <XStack items="center" justify="space-between">
        <YStack>
          <H1 fontSize="$8" fontWeight="700" color="$color">
            Habits
          </H1>
          <Paragraph mt="$0.5" fontSize="$3" color="$mutedForeground">
            Track your daily habits and build streaks.
          </Paragraph>
        </YStack>
        <Button
          icon={<Plus size={16} />}
          onPress={() => setShowCreateDialog(true)}
        >
          New Habit
        </Button>
      </XStack>

      {/* Date selector */}
      <XStack items="center" gap="$3">
        <DatePicker
          value={selectedDate ? parseDateLocal(selectedDate) : null}
          onChange={(d) =>
            setSelectedDate(d ? format(d, "yyyy-MM-dd") : todayStr)
          }
          placeholder="Select date"
          isDateDisabled={(d) => d > new Date()}
        />
        {!isViewingToday && (
          <Text
            tag="button"
            rounded="$md"
            px="$3"
            py="$1.5"
            fontSize="$1"
            fontWeight="500"
            color="$primary"
            hoverStyle={{ bg: "$primaryMuted" }}
            onPress={() => setSelectedDate(todayStr)}
          >
            Back to today
          </Text>
        )}
        {!isViewingToday && (
          <Text fontSize="$1" color="$mutedForeground">
            Viewing:{" "}
            {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMM d, yyyy")}
          </Text>
        )}
      </XStack>

      {isLoading ? (
        <View
          display="grid"
          gap="$4"
          gridTemplateColumns={"1fr" as never}
          $sm={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" as never }}
          $lg={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" as never }}
        >
          {[1, 2, 3].map((i) => (
            <YStack
              key={i}
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
        </View>
      ) : habits && habits.length > 0 ? (
        <View
          display="grid"
          gap="$4"
          gridTemplateColumns={"1fr" as never}
          $sm={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" as never }}
          $lg={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" as never }}
        >
          {habits.map((habit: Habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              selectedDate={isViewingToday ? undefined : selectedDate}
            />
          ))}
        </View>
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
