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
    // CONTAINER-responsive wrapping row, Tamagui-standard primitives only:
    // an `XStack` (flexbox) with `flexWrap` — NOT CSS grid (the kit forbids
    // `display:grid`) and NOT `$md`/`$lg` media props.
    //
    // Why not media props / useMedia: Tamagui media rules are VIEWPORT-based
    // (`min/maxWidth` on the window — see use-media.md). The card area's width
    // swings hugely with the sidebars (≈580px with both rails open, ≈1500px
    // with the nav rail collapsed) while the viewport barely changes, so a
    // viewport breakpoint can't pick the right column count. Flexbox sizes its
    // children relative to the PARENT, so a percentage `flexBasis` is naturally
    // container-relative — the right tool here.
    //
    // Max-3 cap with responsive fall-off: each card wrapper gets
    //   flexBasis = (100% − 24px) / 3   (one-third minus the two 12px gaps)
    // so exactly 3 fill a row and a 4th wraps — never more than 3 columns.
    // `minW={180}` is the floor: as the container narrows, the one-third basis
    // would drop below 180px, so the floor forces it wider and the row steps
    // DOWN to 2, then 1 column. `flexGrow={0}` keeps a partial last row's cards
    // at their one-third width (left-aligned) instead of stretching them.
    // `items="flex-start"` lets each card size to its own content (no
    // equal-height stretch inflating the card's internal `flex={1}` spacer).
    // (No drag in card view — kit Sortable is vertical-only; reorder lives in
    // list view.)
    return (
      <XStack flexWrap="wrap" gap={12} items="flex-start">
        {habits.map((habit) => (
          <View
            key={habit.id}
            flexBasis={"calc((100% - 24px) / 3)" as never}
            flexGrow={0}
            minW={180}
          >
            <HabitCard
              habit={habit}
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
