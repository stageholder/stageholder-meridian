// apps/mobile/components/habit-card-row.tsx
//
// One habit's card + its data wiring, extracted from the habits screen so it can
// be reused by the grouped Sortable sections AND the Archived list. HabitCard
// needs a `useHabitEntries` query + several mutation hooks, and React hooks
// can't run inside a `.map`, so each row is its own component.
//
// Mutations resolve via `mutateAsync` so HabitCard can sequence its bounce /
// completion animations on success (the view awaits onCheckIn etc. and skips
// the celebration when the promise rejects). The entry hooks are optimistic, so
// the card flips instantly; the awaited promise just gates the animation.
//
// Entry actions ALL follow the create-or-update rule: the API has ONE entry per
// habit per day, so POSTing a second one for a day that already has an entry
// returns 409. Every action that sets today's state POSTs when there's no entry
// yet, else PATCHes the existing one. (See the long-standing note in
// hooks/habits.ts.)

import { Celebration, useToast } from "@stageholder/ui";
import { HabitCard } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";

import {
  useCheckInHabit,
  useDeleteHabit,
  useFailHabit,
  useHabitEntries,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";
import { localDateKey } from "@/lib/streak";

export interface HabitCardRowProps {
  habit: Habit;
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
  onEdit,
  onOpenDetail,
  isArchived,
  onArchive,
  onUnarchive,
  onMoveToGroup,
}: HabitCardRowProps) {
  const toast = useToast();
  const entriesQuery = useHabitEntries(habit.id);
  const checkIn = useCheckInHabit();
  const skip = useSkipHabit();
  const fail = useFailHabit();
  const updateEntry = useUpdateHabitEntry();
  const deleteHabit = useDeleteHabit();

  const today = localDateKey();
  const entries = entriesQuery.data;

  // The active-date entry — Undo / Clear-status target the right entry id
  // (PATCH, not DELETE, mirroring the PWA's habit-card undo path).
  const todayEntry = entries?.find((e) => e.date.split("T")[0] === today);

  const isPending =
    checkIn.isPending ||
    skip.isPending ||
    fail.isPending ||
    updateEntry.isPending;

  return (
    <HabitCard
      habit={habit}
      entries={entries}
      // Resolved hex (IGNITION.habit) — HabitCard applies these via the style
      // hatch (`backgroundColor`), so raw colors are required (tokens / CSS
      // vars wouldn't resolve on native).
      accentColor={IGNITION.habit.base}
      accentTrackColor={IGNITION.habit.track}
      // Completion celebration — fires once per completion, in habit-orange
      // embers, only when a check-in actually MEETS the target.
      renderCompletionEffect={(active) => (
        <Celebration
          trigger={active}
          preset="ember-burst"
          colors={["#f97316", "#fb923c", "#fdba74"]}
        />
      )}
      isPending={isPending}
      // ── Entry actions — ALL follow the create-or-update rule ──
      onCheckIn={async () => {
        try {
          if (!todayEntry) {
            await checkIn.mutateAsync({ habitId: habit.id, date: today });
          } else {
            const isNonCompletion =
              todayEntry.type === "skip" || todayEntry.type === "fail";
            await updateEntry.mutateAsync({
              habitId: habit.id,
              entryId: todayEntry.id,
              patch: isNonCompletion
                ? { type: "completion", value: 1 }
                : { value: (todayEntry.value ?? 0) + 1 },
            });
          }
        } catch (e) {
          toast.show({ title: "Couldn't check in", intent: "danger" });
          // Re-throw so HabitCard's awaited handler skips the celebration.
          throw e;
        }
      }}
      onSkip={async () => {
        try {
          if (!todayEntry) {
            await skip.mutateAsync({ habitId: habit.id, date: today });
          } else {
            await updateEntry.mutateAsync({
              habitId: habit.id,
              entryId: todayEntry.id,
              patch: { type: "skip", value: 0 },
            });
          }
        } catch {
          toast.show({ title: "Couldn't skip", intent: "danger" });
        }
      }}
      onFail={async () => {
        try {
          if (!todayEntry) {
            await fail.mutateAsync({ habitId: habit.id, date: today });
          } else {
            await updateEntry.mutateAsync({
              habitId: habit.id,
              entryId: todayEntry.id,
              patch: { type: "fail", value: 0 },
            });
          }
        } catch {
          toast.show({ title: "Couldn't mark failed", intent: "danger" });
        }
      }}
      onUndo={async () => {
        if (!todayEntry) return;
        try {
          await updateEntry.mutateAsync({
            habitId: habit.id,
            entryId: todayEntry.id,
            patch: { value: Math.max(0, (todayEntry.value ?? 0) - 1) },
          });
        } catch {
          toast.show({ title: "Couldn't undo", intent: "danger" });
        }
      }}
      onClearStatus={async () => {
        if (!todayEntry) return;
        try {
          await updateEntry.mutateAsync({
            habitId: habit.id,
            entryId: todayEntry.id,
            patch: { value: 0, type: "completion" },
          });
        } catch {
          toast.show({ title: "Couldn't clear status", intent: "danger" });
        }
      }}
      onEdit={onEdit}
      onOpenDetail={onOpenDetail}
      // Delete IS wired — the card's own AlertDialog confirms first.
      onDelete={() => deleteHabit.mutate(habit.id)}
      // Group + archive affordances — present only when the host wires them.
      isArchived={isArchived}
      onArchive={onArchive}
      onUnarchive={onUnarchive}
      onMoveToGroup={onMoveToGroup}
    />
  );
}
