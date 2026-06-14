import { Sortable, View, XStack, YStack, useToast } from "@stageholder/ui";
import { HabitCard } from "@/components/habits/habit-card";
import { HabitListItem } from "@/components/habits/habit-list-item";
import { useReorderHabits, useArchiveHabit } from "@/lib/api/habits";
import type { Habit } from "@repo/core/types";

export type HabitViewMode = "card" | "list";

interface HabitGroupSectionProps {
  /** The habits in THIS group, already filtered + order-sorted by the host. */
  habits: Habit[];
  /** The groupId these habits belong to (null = Ungrouped) — carried in the
   *  reorder payload so the server keeps them in this group. */
  groupId: string | null;
  viewMode: HabitViewMode;
  /** Selected date (undefined = today) — forwarded to the card/list items. */
  selectedDate?: string;
  /** Open the move-to-group picker for a habit. */
  onMoveToGroup: (habit: Habit) => void;
}

/**
 * One group's habits.
 *  - CARD view: responsive grid (1 / 2 / 3 cols), matching the rest of the app.
 *    Kit `Sortable` is a vertical list and can't lay out a wrapping grid, so
 *    drag-reorder is NOT offered in card view (use list view to reorder).
 *  - LIST view: a vertical `Sortable` with drag-reorder. Within-group drag
 *    re-indexes by position and persists the full sparse update carrying
 *    `{id, order, groupId}`.
 */
export function HabitGroupSection({
  habits,
  groupId,
  viewMode,
  selectedDate,
  onMoveToGroup,
}: HabitGroupSectionProps) {
  const reorderHabits = useReorderHabits();
  const archiveHabit = useArchiveHabit();
  const toast = useToast();

  function archive(habit: Habit) {
    archiveHabit.mutate(habit.id, {
      onSuccess: () =>
        toast.show({ title: `"${habit.name}" archived`, intent: "success" }),
      onError: () =>
        toast.show({ title: "Couldn't archive habit", intent: "danger" }),
    });
  }

  function handleReorder(from: number, to: number) {
    const next = [...habits];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    reorderHabits.mutate({
      items: next.map((h, i) => ({ id: h.id, order: i, groupId })),
    });
  }

  if (viewMode === "card") {
    // Responsive grid: 1 col mobile, 2 col ≥$md, 3 col ≥$lg — each card in a
    // sized View, the card fills its column via flex. (No drag in card view —
    // kit Sortable is vertical-only; reorder lives in list view.)
    return (
      <XStack flexWrap="wrap" gap="$4">
        {habits.map((habit) => (
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
              selectedDate={selectedDate}
              isArchived={false}
              onArchive={() => archive(habit)}
              onMoveToGroup={() => onMoveToGroup(habit)}
            />
          </View>
        ))}
      </XStack>
    );
  }

  // List view: vertical Sortable with drag-reorder within the group.
  return (
    <YStack gap="$2">
      <Sortable
        items={habits}
        keyExtractor={(h) => h.id}
        onReorder={handleReorder}
        renderItem={(habit) => (
          <View width="100%" pb="$2">
            <HabitListItem
              habit={habit}
              selectedDate={selectedDate}
              isArchived={false}
              onArchive={() => archive(habit)}
              onMoveToGroup={() => onMoveToGroup(habit)}
            />
          </View>
        )}
      />
    </YStack>
  );
}
