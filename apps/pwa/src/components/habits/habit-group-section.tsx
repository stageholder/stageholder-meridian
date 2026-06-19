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
    // CONTAINER-responsive grid via real CSS Grid. PWA is web-only, so a plain
    // <div> (not a Tamagui View, which forces the flex display model) gives a
    // reliable `display:grid` — the kit's "no CSS grid, use flexbox" rule is for
    // the cross-platform packages, not here.
    //
    // Grid over the old `$md`/`$lg` *viewport* breakpoints (768/1024px) because
    // those measure the WINDOW, not this column. The card area's width swings
    // hugely with the sidebars (≈580px with both rails open, ≈1500px with the
    // nav rail collapsed) while the viewport barely changes — so viewport media
    // can't pick the right column count. CSS grid keys off the real container.
    //
    // `repeat(auto-fit, minmax(180px, 1fr))`: as many columns as fit at ≥180px,
    // and auto-FIT collapses the leftover empty tracks so the actual cards grow
    // (1fr) to FILL the row — 3 columns whether the area is 580px (≈190px cards)
    // or 1500px (≈500px cards). (auto-FILL kept the empty tracks, which is why
    // the cards previously sat at 180px with dead space to the right.)
    //
    // `alignItems: start` is the key compactness fix: grid's default stretches
    // every card to the tallest in its row, which inflated the card's internal
    // `flex={1}` spacer into a big empty gap. `start` lets each card size to its
    // own content, so the week strip + actions sit right under the header.
    // (No drag in card view — kit Sortable is vertical-only; reorder lives in
    // list view.)
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
