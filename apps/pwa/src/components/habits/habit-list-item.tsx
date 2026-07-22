import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, SkipForward } from "lucide-react";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  RippleButton,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import { HabitCheckInRow } from "@repo/features/habits";
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

interface HabitListItemProps {
  habit: Habit;
  /** When set, the row shows status for this date instead of today. */
  selectedDate?: string;
  /** Present → "Archive" appears in the menu (host wires the mutation). */
  onArchive?: () => void;
  /** Present → "Unarchive" appears in the menu. */
  onUnarchive?: () => void;
  /** Whether this habit is archived (drives the menu label). */
  isArchived?: boolean;
  /** Present → "Move to group…" appears in the menu. */
  onMoveToGroup?: () => void;
}

/**
 * Compact horizontal row treatment of a habit, used by the list view mode on
 * the habits page. It is now a thin wrapper over the CROSS-PLATFORM
 * `HabitCheckInRow` (@repo/features/habits) — shared with the mobile app so the
 * identity + check-in status control never drift. This wrapper keeps the
 * PWA-specific pieces the shared row doesn't own:
 *   • the data hooks + create-or-update handlers (same as the card view),
 *   • the current-week dot strip (passed as `middleSlot`),
 *   • the overflow menu + edit-sheet + delete-dialog (as `trailingSlot`),
 *   • the RadianceBurst completion sunburst (as `controlOverlay`).
 */
export function HabitListItem({
  habit,
  selectedDate,
  onArchive,
  onUnarchive,
  isArchived,
  onMoveToGroup,
}: HabitListItemProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const activeDate = selectedDate || today;
  const isViewingToday = !selectedDate || selectedDate === today;
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  // Include the active date in the window (the date-nav can jump past 90 days
  // back) so an existing entry there isn't misread as un-acted → duplicate 409.
  const startDate = activeDate < ninetyDaysAgo ? activeDate : ninetyDaysAgo;
  const endDate = activeDate > today ? activeDate : today;

  const { data: entries, isLoading: entriesLoading } = useHabitEntries(
    habit.id,
    { startDate, endDate },
  );
  // COLD load only (background refetches keep `entries` populated). Until the
  // entries arrive we can't know the day's status, so gate the status/action
  // slot on a skeleton instead of defaulting to the un-acted "Complete" button.
  const statusLoading = entriesLoading && entries === undefined;

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabitEntry();
  const failEntry = useFailHabitEntry();
  const deleteHabit = useDeleteHabit();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Completion celebration: the RadianceBurst sunburst fires when a check-in
  // COMPLETES the day. (The press-bounce on the control lives in the shared row.)
  const [completing, setCompleting] = useState(false);

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  // Use the entry's snapshotted target (via resolveTargetCount) so "Done" agrees
  // with the card view + week strip after the habit's target is later changed.
  const targetCount = resolveTargetCount(activeDateEntry ?? {}, habit) || 1;
  const isComplete = activeDateValue >= targetCount;
  const isSkipped = activeDateEntry?.type === "skip";
  const isFailed = activeDateEntry?.type === "fail";

  const dateLabel = isViewingToday
    ? habit.name
    : `${habit.name} (${activeDate})`;

  // A brief guard ONLY while a just-created entry is still a temp (unsaved)
  // record — acting on it would PATCH a temp id (404). It clears the instant the
  // create resolves (temp→real swap). We deliberately do NOT gate on network
  // `isSaving`: the optimistic cache already reflects each tap, and the entry
  // mutations are scope-serialized, so rapid taps stay safe AND responsive
  // instead of the control going dead for the whole round-trip.
  const isSaving = activeDateEntry?.id?.startsWith("temp-") ?? false;

  async function handleCheckIn() {
    if (isComplete || isSaving) return;
    // Predict completion from the before-value so the burst fires on the same
    // tick as the mutation (mirrors the card view — no wait on a refetch).
    const newValue = isSkipped || isFailed ? 1 : activeDateValue + 1;
    const willComplete = newValue >= targetCount;
    try {
      if (!activeDateEntry) {
        await createEntry.mutateAsync({
          habitId: habit.id,
          data: { date: activeDate, value: 1 },
        });
      } else {
        const isNonCompletion = isSkipped || isFailed;
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
      // Skip the celebration when the mutation failed (cache rolls back).
      return;
    }
    if (willComplete) {
      setCompleting(true);
      setTimeout(() => setCompleting(false), 1200);
    }
  }

  async function handleSkip() {
    if (isComplete || isSkipped || isSaving) return;
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
    if (isComplete || isFailed || isSaving) return;
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
    if (activeDateValue <= 0 || isSaving) return;
    if (!activeDateEntry) return;
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
    if (!activeDateEntry || isSaving) return;
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
    setDeleteOpen(false);
  }

  // Current-week dot strip (M T W T F S S) — same data + status logic as the
  // card view's week strip, rendered as a compact inline run so the list row
  // gives the same at-a-glance streak read.
  const isQuota = habit.frequency === "weekly_target";
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find(
      (e: HabitEntry) => e.date.split("T")[0] === dateStr,
    );
    const dow = date.getDay();
    // Quota habits have no rest days — every day is schedulable/loggable.
    const isScheduled =
      isQuota ||
      !habit.scheduledDays ||
      habit.scheduledDays.length === 0 ||
      habit.scheduledDays.includes(dow);
    const effectiveTarget =
      (entry ? resolveTargetCount(entry, habit) : habit.targetCount) || 1;
    return {
      label: format(date, "EEEEE"),
      dateStr,
      value: entry?.value ?? 0,
      type: entry?.type as "completion" | "skip" | "fail" | undefined,
      isToday: dateStr === today,
      isScheduled,
      effectiveTarget,
    };
  });

  // Week-dot strip — passed to the shared row as its middle slot. Hidden below
  // md where the row is too narrow to fit it.
  const weekStrip = (
    <XStack
      shrink={0}
      gap="$2"
      items="flex-end"
      display="none"
      $md={{ display: "flex" }}
    >
      {weekDays.map((day) => {
        const ratio =
          day.effectiveTarget > 0 ? day.value / day.effectiveTarget : 0;
        const isDaySkipped = day.type === "skip";
        const isDayFailed = day.type === "fail";
        const isPast = day.dateStr < today;
        const complete = !isDaySkipped && !isDayFailed && ratio >= 1;
        // Auto-fail only truly-missed scheduled days (no entry). Quota habits
        // never auto-fail. Mirrors the card view's dot logic.
        const failed =
          !isQuota &&
          (isDayFailed ||
            (day.isScheduled && isPast && day.type === undefined));
        const partial = !isDaySkipped && !failed && ratio > 0 && ratio < 1;
        return (
          <YStack key={day.dateStr} items="center" gap="$1">
            <Text
              fontSize={9}
              fontWeight="500"
              color="$mutedForeground"
              opacity={day.isScheduled ? 0.8 : 0.35}
            >
              {day.label}
            </Text>
            <View
              width={11}
              height={11}
              rounded={9999}
              transition="quick"
              items="center"
              justify="center"
              borderWidth={complete || isDaySkipped ? 0 : 1}
              borderStyle={!day.isScheduled ? "dashed" : "solid"}
              borderColor={failed ? "$destructive" : "$mutedForeground"}
              opacity={
                !day.isScheduled
                  ? 0.3
                  : isDaySkipped
                    ? 0.75
                    : complete || partial || failed
                      ? 1
                      : 0.4
              }
              outlineWidth={day.isToday ? 2 : 0}
              outlineColor="$primary"
              outlineStyle="solid"
              outlineOffset={1}
              bg={
                (complete
                  ? "var(--ring-habit)"
                  : partial
                    ? "var(--ring-habit-track)"
                    : "transparent") as never
              }
            >
              {isDaySkipped ? (
                <Text color="$mutedForeground" lineHeight={0}>
                  <SkipForward size={9} />
                </Text>
              ) : null}
            </View>
          </YStack>
        );
      })}
    </XStack>
  );

  // Overflow menu — edit / move / archive / delete (skip/fail/undo are inline
  // in the shared control). Passed as the shared row's trailing slot.
  const menu = (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        {/* RippleButton (not IconButton): ripple press feedback instead of a
            press-scale that would shift the menu's anchor as it opens. */}
        <RippleButton
          intent="ghost"
          size="sm"
          iconOnly
          width="$sm"
          aria-label="Habit options"
        >
          <MoreHorizontal size={16} />
        </RippleButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onPress={() => setEditOpen(true)}>
          <DropdownMenu.Label>Edit</DropdownMenu.Label>
        </DropdownMenu.Item>
        {onMoveToGroup && (
          <DropdownMenu.Item onPress={onMoveToGroup}>
            <DropdownMenu.Label>Move to group…</DropdownMenu.Label>
          </DropdownMenu.Item>
        )}
        {isArchived && onUnarchive && (
          <DropdownMenu.Item onPress={onUnarchive}>
            <DropdownMenu.Label>Unarchive</DropdownMenu.Label>
          </DropdownMenu.Item>
        )}
        {!isArchived && onArchive && (
          <DropdownMenu.Item onPress={onArchive}>
            <DropdownMenu.Label>Archive</DropdownMenu.Label>
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <DropdownMenu.Item intent="danger" onPress={() => setDeleteOpen(true)}>
          <DropdownMenu.Label>Delete</DropdownMenu.Label>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );

  return (
    <>
      <HabitCheckInRow
        habit={habit}
        value={activeDateValue}
        target={targetCount}
        isSkipped={!!isSkipped}
        isFailed={!!isFailed}
        loading={statusLoading}
        disabled={isSaving}
        // PWA accent = CSS vars (resolve in the theme cascade on web).
        accentColor="var(--ring-habit)"
        accentTrackColor="var(--ring-habit-track)"
        minHeight={60}
        onOpenDetail={() =>
          void navigate({ to: "/habits/$id", params: { id: habit.id } })
        }
        onCheckIn={handleCheckIn}
        onSkip={handleSkip}
        onFail={handleFail}
        onUndo={handleUndo}
        onClearStatus={handleClearStatus}
        // Show the viewed date as a subtitle when reviewing a past day; else the
        // habit description (preserves the old "name (date)" indicator).
        subtitle={
          isViewingToday
            ? habit.description || undefined
            : `Viewing ${activeDate}`
        }
        middleSlot={weekStrip}
        trailingSlot={menu}
        controlOverlay={<RadianceBurst active={completing} />}
        // Keep control clicks alive when the row is a drag item in `Sortable`.
        onActionsPointerDown={(e) => e.stopPropagation()}
      />

      <EditHabitSheet
        habit={habit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* AlertDialog REQUIRES Portal + Overlay wrappers — without them the
          kit's `AlertDialog.Content` renders inline rather than as a modal
          overlay. Conditionally mounted so CLOSING UNMOUNTS the dialog (overlay
          removed instantly): the kit's exit-presence doesn't fire under this
          app's runtime-CSS setup (Tailwind coexistence forces disableExtraction),
          so closing via state alone left the scrim stuck. A full unmount clears
          it reliably. */}
      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Content>
            <AlertDialog.Title>Delete habit?</AlertDialog.Title>
            <AlertDialog.Description>
              This will permanently delete &quot;{habit.name}&quot; and all of
              its entries. This action cannot be undone.
            </AlertDialog.Description>
            <XStack gap="$3" justify="flex-end" mt="$4">
              <AlertDialog.Cancel asChild>
                <Button intent="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button intent="destructive" onPress={handleDelete}>
                  Delete
                </Button>
              </AlertDialog.Action>
            </XStack>
          </AlertDialog.Content>
        </AlertDialog>
      )}
    </>
  );
}
