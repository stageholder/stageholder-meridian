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

import { memo } from "react";
import { Sortable, Text, View, XStack, YStack } from "@stageholder/ui";
import type { Habit } from "@repo/core/types";

import { HabitCardRow } from "@/components/habit-card-row";
import { HabitCheckInRow } from "@/components/habit-check-in-row";
import { useReorderHabits } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

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
  /** Disable drag-reorder — set while a status filter is active, since the
   *  section only holds the VISIBLE (filtered) habits and re-indexing them
   *  would collide with the filtered-out habits' orders. */
  reorderDisabled?: boolean;
  /** "card" = big HabitCard rows; "list" = compact HabitCheckInRow. Default card. */
  viewMode?: "card" | "list";
  /** The day the rows act on (yyyy-mm-dd). Omit → today. */
  selectedDate?: string;
  onEdit: (habit: Habit) => void;
  onOpenDetail: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onMoveToGroup: (habit: Habit) => void;
}

// PERF: memoized — the habits screen re-renders on every sheet open / filter
// tap, and each section carries a Sortable plus a full HabitCard (dropdown,
// week dots, per-card entries query) per habit. The screen passes stable
// (useCallback) handlers + memoized `habits` arrays, so the shallow compare
// bails whole sections out of those unrelated re-renders.
export const HabitGroupSection = memo(function HabitGroupSection({
  name,
  color,
  icon,
  habits,
  groupId,
  hideHeader,
  reorderDisabled,
  viewMode = "card",
  selectedDate,
  onEdit,
  onOpenDetail,
  onArchive,
  onMoveToGroup,
}: HabitGroupSectionProps) {
  const reorderHabits = useReorderHabits();
  const activeDate = selectedDate ?? localDateKey();

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
        disabled={reorderDisabled}
        renderItem={(habit) => (
          <View width="100%" pb="$2">
            {viewMode === "list" ? (
              // Compact list view — inline check-in; management (edit / archive
              // / move / delete) is via the detail screen on tap.
              <HabitCheckInRow
                habit={habit}
                activeDate={activeDate}
                onOpenDetail={() => onOpenDetail(habit)}
              />
            ) : (
              <HabitCardRow
                habit={habit}
                selectedDate={selectedDate}
                isArchived={false}
                onEdit={() => onEdit(habit)}
                onOpenDetail={() => onOpenDetail(habit)}
                onArchive={() => onArchive(habit)}
                onMoveToGroup={() => onMoveToGroup(habit)}
              />
            )}
          </View>
        )}
      />
    </YStack>
  );
});
