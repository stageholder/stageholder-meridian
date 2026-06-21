import { Sortable, View, YStack, useToast } from "@stageholder/ui";
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
    // CONTAINER-responsive grid via real CSS Grid in a plain <div>. The PWA is
    // web-only, so the kit's "no CSS grid, use flexbox" rule (which exists for
    // the cross-platform packages) doesn't apply here — and grid is the ONLY
    // tool that does all four of these at once:
    //   1. cap at a HARD MAX of 3 columns,
    //   2. FILL the row width at every size (cards grow, no dead space),
    //   3. step down to 2 then 1 column as the container narrows,
    //   4. keep every card the SAME width (incl. a partial last row).
    // Flexbox can't: a fixed `flexBasis` can't fill a 2-card row to halves
    // while still capping 3-card rows at thirds (flexGrow=0 leaves dead space;
    // flexGrow=1 stretches a lone last-row card to full width, inconsistent).
    // Media props are out too — they're VIEWPORT-based (use-media.md), but the
    // card area's width swings with the sidebars while the viewport barely
    // moves, so a window breakpoint can't pick the column count.
    //
    // `minmax(max(180px, (100% - 24px) / 3), 1fr)`:
    //   • track floor = max(180px, one-third-minus-gaps) → caps at 3 columns
    //     (a 4th can't meet the one-third floor) and, once one-third drops
    //     below 180px, forces the grid down to 2 then 1 column;
    //   • `1fr` max → the resolved columns GROW to fill the row (3 → thirds,
    //     2 → halves, 1 → full), and a partial last row's cards stay at that
    //     same column width (left-aligned), so all cards match.
    // `alignItems: start` stops grid's default equal-height stretch from
    // inflating each card's internal `flex={1}` spacer into a big empty gap.
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(max(180px, (100% - 24px) / 3), 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            minW={0}
            selectedDate={selectedDate}
            isArchived={false}
            onArchive={() => archive(habit)}
            onMoveToGroup={() => onMoveToGroup(habit)}
          />
        ))}
      </div>
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
