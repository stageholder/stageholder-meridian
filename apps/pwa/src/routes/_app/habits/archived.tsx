import { createFileRoute } from "@tanstack/react-router";
import { Archive, RotateCcw } from "lucide-react";
import {
  Button,
  EmptyState,
  List,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { useArchivedHabits, useUnarchiveHabit } from "@/lib/api/habits";
import type { Habit } from "@repo/core/types";

export const Route = createFileRoute("/_app/habits/archived")({
  component: ArchivedHabitsPage,
});

/**
 * Archived habits — a kit `List` of the user's archived habits, each with a
 * Restore button that unarchives it (preserving history). EmptyState when none.
 */
function ArchivedHabitsPage() {
  const { data: habits, isLoading } = useArchivedHabits();
  const unarchive = useUnarchiveHabit();
  const toast = useToast();

  function handleRestore(habit: Habit) {
    unarchive.mutate(habit.id, {
      onSuccess: () =>
        toast.show({ title: `"${habit.name}" restored`, intent: "success" }),
      onError: () =>
        toast.show({ title: "Failed to restore habit", intent: "danger" }),
    });
  }

  const hasHabits = (habits?.length ?? 0) > 0;

  return (
    <YStack gap="$6" p="$4">
      <XStack items="center" gap="$2.5">
        <Text color="$color" lineHeight={0}>
          <Archive size={20} />
        </Text>
        <Text fontSize="$7" fontWeight="700" color="$color">
          Archived
        </Text>
      </XStack>

      {isLoading ? (
        <List loading loadingRows={4} />
      ) : hasHabits ? (
        <List>
          {(habits ?? []).map((habit: Habit) => (
            <List.Item key={habit.id} interactive={false}>
              <XStack items="center" gap="$3" width="100%">
                <View
                  width={36}
                  height={36}
                  rounded="$lg"
                  items="center"
                  justify="center"
                  shrink={0}
                  bg="$muted"
                >
                  <Text fontSize="$6">{habit.icon || "🎯"}</Text>
                </View>
                <YStack flex={1} minW={0} gap="$0.5">
                  <List.Title>{habit.name}</List.Title>
                  {habit.description ? (
                    <List.Description numberOfLines={1}>
                      {habit.description}
                    </List.Description>
                  ) : null}
                </YStack>
                <Button
                  intent="outline"
                  size="sm"
                  icon={<RotateCcw size={14} />}
                  disabled={unarchive.isPending}
                  onPress={() => handleRestore(habit)}
                >
                  Restore
                </Button>
              </XStack>
            </List.Item>
          ))}
        </List>
      ) : (
        <EmptyState>
          <EmptyState.IconSlot>
            <Archive size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>No archived habits</EmptyState.Title>
          <EmptyState.Description>
            Archive a habit from its menu to keep its history without showing it
            in your list.
          </EmptyState.Description>
        </EmptyState>
      )}
    </YStack>
  );
}
