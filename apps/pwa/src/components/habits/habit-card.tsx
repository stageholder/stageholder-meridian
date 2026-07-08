import { useState } from "react";
import { format, subDays } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "@stageholder/ui";
import { HabitCard as HabitCardView } from "@repo/features/habits";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useSkipHabitEntry,
  useFailHabitEntry,
  useHabitEntries,
  useDeleteHabit,
} from "@/lib/api/habits";
import { EditHabitSheet } from "./edit-habit-sheet";
import { RadianceBurst } from "./radiance-burst";

interface HabitCardProps {
  habit: Habit;
  /** When set, the card shows status for this date instead of today */
  selectedDate?: string;
  /** Flex layout hints forwarded to the card root (auto-fit grid). */
  flex?: number;
  minW?: number;
  /** Present → "Archive" appears in the card menu (host wires the mutation). */
  onArchive?: () => void;
  /** Present → "Restore" appears in the card menu. */
  onUnarchive?: () => void;
  /** Whether this habit is archived (drives the menu label). */
  isArchived?: boolean;
  /** Present → "Move to group…" appears in the card menu. */
  onMoveToGroup?: () => void;
}

/**
 * PWA wrapper around the cross-platform `HabitCard` view in `@repo/features`.
 *
 * Owns:
 *  - Data wiring (`useHabitEntries`, the four entry mutations, `useDeleteHabit`).
 *  - Toast feedback on success / failure (kit `toast` is cross-platform
 *    but the wording is mutation-specific and lives next to the mutation).
 *  - The web-only `EditHabitSheet` (its own SDK-hook tangle, deferred to a
 *    later platform-suffix split).
 *  - The web-only `RadianceBurst` celebration effect (bespoke CSS keyframes;
 *    plugged in via the view's `renderCompletionEffect` render-prop).
 *  - The orange habit category color (CSS vars driven by the design
 *    tokens shared with activity-rings + calendar).
 */
export function HabitCard({
  habit,
  selectedDate,
  flex,
  minW,
  onArchive,
  onUnarchive,
  isArchived,
  onMoveToGroup,
}: HabitCardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const activeDate = selectedDate || today;
  const isViewingToday = !selectedDate || selectedDate === today;
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  // Always include the active date in the fetched window: the date-nav can jump
  // past 90 days back, and if the selected day's entry isn't fetched the card
  // reads it as un-acted and a check-in POSTs a duplicate → 409.
  const startDate = activeDate < ninetyDaysAgo ? activeDate : ninetyDaysAgo;
  const endDate = activeDate > today ? activeDate : today;

  const { data: entries, isLoading: entriesLoading } = useHabitEntries(
    habit.id,
    { startDate, endDate },
  );

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabitEntry();
  const failEntry = useFailHabitEntry();
  const deleteHabit = useDeleteHabit();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const dateLabel = isViewingToday
    ? habit.name
    : `${habit.name} (${activeDate})`;

  async function handleCheckIn() {
    try {
      if (!activeDateEntry) {
        await createEntry.mutateAsync({
          habitId: habit.id,
          data: { date: activeDate, value: 1 },
        });
      } else {
        // An entry exists. If it's a skip or fail (value=0), promote it to a
        // completion in one PATCH — the API zeros skipReason and stamps type
        // for us. For an in-progress completion, increment value.
        const isNonCompletion =
          activeDateEntry.type === "skip" || activeDateEntry.type === "fail";
        await updateEntry.mutateAsync({
          habitId: habit.id,
          entryId: activeDateEntry.id,
          data: isNonCompletion
            ? { type: "completion", value: 1 }
            : { value: activeDateValue + 1 },
        });
      }
      toast.success(`Checked in for ${dateLabel}`);
    } catch {
      toast.error("Failed to check in");
      // Re-throw so the view's `onCheckIn` promise rejects and the
      // post-success celebration animations are skipped.
      throw new Error("check-in failed");
    }
  }

  async function handleSkip() {
    try {
      if (!activeDateEntry) {
        await skipEntry.mutateAsync({
          habitId: habit.id,
          data: { date: activeDate },
        });
      } else {
        await updateEntry.mutateAsync({
          habitId: habit.id,
          entryId: activeDateEntry.id,
          data: { type: "skip", value: 0 },
        });
      }
      toast.success(`Skipped ${habit.name}`);
    } catch {
      toast.error("Failed to skip");
    }
  }

  async function handleFail() {
    try {
      if (!activeDateEntry) {
        await failEntry.mutateAsync({
          habitId: habit.id,
          data: { date: activeDate },
        });
      } else {
        await updateEntry.mutateAsync({
          habitId: habit.id,
          entryId: activeDateEntry.id,
          data: { type: "fail", value: 0 },
        });
      }
      toast.success(`Marked ${habit.name} failed`);
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleUndo() {
    // Nothing to undo at 0 — and value-1 would be -1, which the API rejects
    // (value must be >= 0).
    if (!activeDateEntry || activeDateValue <= 0) return;
    try {
      await updateEntry.mutateAsync({
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { value: activeDateValue - 1 },
      });
      toast.success(`Undid check-in for ${habit.name}`);
    } catch {
      toast.error("Failed to undo");
    }
  }

  async function handleClearStatus() {
    if (!activeDateEntry) return;
    try {
      await updateEntry.mutateAsync({
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { type: "completion", value: 0 },
      });
      toast.success(`Cleared ${habit.name}`);
    } catch {
      toast.error("Failed to undo");
    }
  }

  function handleDelete() {
    deleteHabit.mutate(habit.id, {
      onSuccess: () => toast.success(`"${habit.name}" deleted`),
      onError: () => toast.error("Failed to delete habit"),
    });
  }

  const isPending =
    createEntry.isPending ||
    updateEntry.isPending ||
    skipEntry.isPending ||
    failEntry.isPending;

  return (
    <>
      <HabitCardView
        habit={habit}
        entries={entries}
        entriesLoading={entriesLoading && entries === undefined}
        selectedDate={selectedDate}
        // Orange = the habit category identity color (matches the calendar +
        // detail pages). The whole habit surface reads as orange, not the
        // per-habit blue. CSS vars defined in app/globals.css.
        accentColor="var(--ring-habit)"
        accentTrackColor="var(--ring-habit-track)"
        isPending={isPending}
        onCheckIn={handleCheckIn}
        onSkip={handleSkip}
        onFail={handleFail}
        onUndo={handleUndo}
        onClearStatus={handleClearStatus}
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
        onOpenDetail={() =>
          void navigate({ to: "/habits/$id", params: { id: habit.id } })
        }
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        isArchived={isArchived}
        onMoveToGroup={onMoveToGroup}
        renderCompletionEffect={(active) => <RadianceBurst active={active} />}
        flex={flex}
        minW={minW}
      />

      <EditHabitSheet
        habit={habit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
