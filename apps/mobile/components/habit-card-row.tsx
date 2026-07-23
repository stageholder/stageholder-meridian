// apps/mobile/components/habit-card-row.tsx
//
// One habit's card + its data wiring, extracted from the habits screen so it can
// be reused by the grouped Sortable sections AND the Archived list. HabitCard
// needs a `useHabitEntries` query + several mutation hooks, and React hooks
// can't run inside a `.map`, so each row is its own component.
//
// Entry actions are provided by the shared `useHabitDayActions` hook (the single
// source of truth for the create-or-update rules, shared with the compact
// `HabitCheckInRow`). The card flips optimistically; HabitCard awaits the
// returned promise only to sequence its bounce / completion animation (it skips
// the celebration when the promise rejects).
//
// `selectedDate` (yyyy-mm-dd) scopes the card to a day other than today — the
// habits screen's date-nav passes it so you can check in / review a past day.
// Omitted → today. HabitCard is already date-aware (`selectedDate` prop), so we
// just thread the same date into the entries window + the actions hook.

import { toast } from "@stageholder/ui";
import { HabitCard, RadianceBurst } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";

import { useDeleteHabit, useSharedHabitEntries } from "@/lib/api";
import { useHabitDayActions } from "@/lib/hooks/use-habit-day-actions";
import { IGNITION } from "@/lib/ignition-palette";
import { localDateKey } from "@/lib/streak";

export interface HabitCardRowProps {
  habit: Habit;
  /** The day this card acts on (yyyy-mm-dd). Omit → today. */
  selectedDate?: string;
  /** Opens the native edit sheet for this habit (per-card Edit action). */
  onEdit: () => void;
  /** Opens the native habit detail screen (card body tap). */
  onOpenDetail: () => void;
  /** Whether this row is in the Archived view — drives the menu label. */
  isArchived?: boolean;
  /** Archive this habit (active view). */
  onArchive?: () => void;
  /** Restore this habit (archived view). */
  onUnarchive?: () => void;
  /** Open the move-to-group picker for this habit. */
  onMoveToGroup?: () => void;
}

export function HabitCardRow({
  habit,
  selectedDate,
  onEdit,
  onOpenDetail,
  isArchived,
  onArchive,
  onUnarchive,
  onMoveToGroup,
}: HabitCardRowProps) {
  const today = localDateKey();
  const activeDate = selectedDate ?? today;
  // THE canonical shared 90-day window (habitEntriesWindow) — one cache entry
  // + one network fetch per habit, shared with the compact check-in row and
  // the Today aggregate. Widens automatically when the date-nav jumps past 90
  // days back or into the future.
  const entriesQuery = useSharedHabitEntries(habit.id, selectedDate);
  const deleteHabit = useDeleteHabit();

  const entries = entriesQuery.data;
  const actions = useHabitDayActions(habit.id, activeDate, entries);

  return (
    <HabitCard
      habit={habit}
      entries={entries}
      // Date-scoped — HabitCard computes activeDate = selectedDate || today.
      selectedDate={selectedDate}
      // COLD load only — a background refetch keeps `entries` populated. Gates
      // the status/action slot on a skeleton instead of flashing "Check In".
      entriesLoading={entriesQuery.isLoading && entries === undefined}
      // Resolved hex (IGNITION.habit) — HabitCard applies these via the style
      // hatch (`backgroundColor`), so raw colors are required (tokens / CSS
      // vars wouldn't resolve on native).
      accentColor={IGNITION.habit.base}
      accentTrackColor={IGNITION.habit.track}
      // Sunburst ANCHORED to the check-in control (PWA RadianceBurst parity),
      // fires once per completion — NOT the full-screen kit Celebration.
      renderCompletionEffect={(active) => (
        <RadianceBurst active={active} color={IGNITION.habit.base} />
      )}
      isPending={actions.isPending}
      // ── Entry actions — the shared create-or-update hook, date-scoped. ──
      onCheckIn={actions.checkIn}
      onSkip={actions.skip}
      onFail={actions.fail}
      onUndo={actions.undo}
      onClearStatus={actions.clearStatus}
      onEdit={onEdit}
      onOpenDetail={onOpenDetail}
      // Delete IS wired — the card's own AlertDialog confirms first. On failure
      // the optimistic removal rolls back, so surface a toast (L10a).
      onDelete={() =>
        deleteHabit.mutate(habit.id, {
          onError: () => toast.error("Couldn't delete habit"),
        })
      }
      // Group + archive affordances — present only when the host wires them.
      isArchived={isArchived}
      onArchive={onArchive}
      onUnarchive={onUnarchive}
      onMoveToGroup={onMoveToGroup}
    />
  );
}
