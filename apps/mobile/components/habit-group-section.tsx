// apps/mobile/components/habit-group-section.tsx
//
// One group's habits as a VERTICAL kit Sortable — native mirror of the PWA's
// HabitGroupSection (apps/pwa/src/components/habits/habit-group-section.tsx).
//
// Sortable.native activates on LONG-PRESS, so it coexists with the screen's
// PullToRefresh scroller (a normal swipe scrolls; a long-press-then-drag
// reorders). Within-group drag re-indexes by position and persists the full
// sparse update carrying {id, order, groupId} — the server keeps the habit in
// this group while applying the new order.

import { Sortable, Text, View, XStack, YStack } from "@stageholder/ui";
import type { Habit } from "@repo/core/types";

import { HabitCardRow } from "@/components/habit-card-row";
import { useReorderHabits } from "@/lib/api";

interface HabitGroupSectionProps {
  /** Display name + dot color for the section header. */
  name: string;
  color: string;
  /** Emoji icon — when set, shown instead of the color dot. */
  icon?: string;
  /** The habits in THIS group, already filtered + order-sorted by the host. */
  habits: Habit[];
  /** The groupId these habits belong to (null = Ungrouped) — carried in the
   *  reorder payload so the server keeps them in this group. */
  groupId: string | null;
  /** Hide the section header (used when a single group is the active filter). */
  hideHeader?: boolean;
  onEdit: (habit: Habit) => void;
  onOpenDetail: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onMoveToGroup: (habit: Habit) => void;
}

export function HabitGroupSection({
  name,
  color,
  icon,
  habits,
  groupId,
  hideHeader,
  onEdit,
  onOpenDetail,
  onArchive,
  onMoveToGroup,
}: HabitGroupSectionProps) {
  const reorderHabits = useReorderHabits();

  function handleReorder(from: number, to: number) {
    const next = [...habits];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    reorderHabits.mutate({
      items: next.map((h, i) => ({ id: h.id, order: i, groupId })),
    });
  }

  return (
    <YStack gap="$2">
      {hideHeader ? null : (
        <XStack items="center" gap="$2.5" px="$1">
          {icon ? (
            <Text fontSize={16} lineHeight={16} shrink={0}>
              {icon}
            </Text>
          ) : (
            <View
              width={10}
              height={10}
              rounded={9999}
              shrink={0}
              style={{ backgroundColor: color }}
            />
          )}
          <Text fontSize="$5" fontWeight="600" color="$color">
            {name}
          </Text>
          <Text fontSize="$2" color="$mutedForeground">
            {habits.length}
          </Text>
        </XStack>
      )}

      <Sortable
        items={habits}
        keyExtractor={(h) => h.id}
        onReorder={handleReorder}
        renderItem={(habit) => (
          <View width="100%" pb="$2">
            <HabitCardRow
              habit={habit}
              isArchived={false}
              onEdit={() => onEdit(habit)}
              onOpenDetail={() => onOpenDetail(habit)}
              onArchive={() => onArchive(habit)}
              onMoveToGroup={() => onMoveToGroup(habit)}
            />
          </View>
        )}
      />
    </YStack>
  );
}
