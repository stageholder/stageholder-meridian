import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  MoreHorizontal,
  SkipForward,
  Target,
  Undo2,
  X,
} from "lucide-react";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  IconButton,
  MediaGlyph,
  RippleButton,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import { parseMediaIcon } from "@repo/features/habits";
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
 * Compact horizontal row treatment of a habit, used by the list view
 * mode on the habits page. Trades the card view's weekly dot strip and
 * burst animations for a single-row, scannable layout: icon · name +
 * meta · today status · primary action · menu.
 *
 * Wiring mirrors the card-view PWA wrapper (`habit-card.tsx`): same
 * data hooks, same toast wording, same mutation surface. Kept inline
 * (rather than extracted to a hook) until both wrappers stabilize —
 * the row's UX is still iterating.
 *
 * Lift target: once the row's shape is settled this should move into
 * `packages/features/src/habits/habit-list-item.tsx` so the future RN
 * mobile habits screen can use the same view.
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
  // slot on a skeleton instead of defaulting to the un-acted "Complete" button
  // (which caused the reported unchecked→checked flash).
  const statusLoading = entriesLoading && entries === undefined;

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabitEntry();
  const failEntry = useFailHabitEntry();
  const deleteHabit = useDeleteHabit();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Completion celebration (parity with the card view): a button bounce on any
  // check-in, plus the RadianceBurst sunburst when the check-in COMPLETES.
  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  // Use the entry's snapshotted target (via resolveTargetCount) so "Done" agrees
  // with the card view + week strip after the habit's target is later changed.
  // (skip/fail entries carry value 0, so they read as not-complete for target>=1.)
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
    setBouncing(true);
    setTimeout(() => setBouncing(false), 500);
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
  // card view's week strip (`@repo/features/habits` HabitCard), rendered as a
  // compact inline run so the list row gives the same at-a-glance streak read.
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

  return (
    <>
      <XStack
        items="center"
        gap="$3"
        py="$2.5"
        px="$3.5"
        // Shared row height with the compact TodoItem card row so the dashboard
        // Todos / Habits columns line up 1:1 (see todo-item.tsx COMPACT_ROW_MIN_H).
        minHeight={60}
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        transition="quick"
        hoverStyle={{ borderColor: "$primary" }}
      >
        {/* Identity: icon badge + name + description.
            The icon-and-name pair is the row's pressable surface for
            opening the detail page — matches the card view's same
            "tap-icon-or-title to drill in" affordance. */}
        <XStack
          flex={1}
          minW={0}
          items="center"
          gap="$3"
          onPress={() =>
            void navigate({ to: "/habits/$id", params: { id: habit.id } })
          }
          cursor="pointer"
          role="button"
          aria-label={`Open ${habit.name}`}
          transition="quick"
          hoverStyle={{ opacity: 0.85 }}
        >
          <View
            width={36}
            height={36}
            shrink={0}
            rounded="$lg"
            items="center"
            justify="center"
            style={{ backgroundColor: "var(--ring-habit-track)" }}
          >
            <MediaGlyph
              value={parseMediaIcon(habit.icon)}
              size={20}
              fallback={
                <Text color={"var(--ring-habit)" as never} lineHeight={0}>
                  <Target size={16} />
                </Text>
              }
            />
          </View>
          <YStack flex={1} minW={0} justify="center" gap="$0.5">
            <Text
              fontSize="$3"
              fontWeight="600"
              color="$color"
              numberOfLines={1}
              lineHeight={18}
            >
              {habit.name}
            </Text>
            {habit.description ? (
              <Text
                fontSize="$1"
                color="$mutedForeground"
                numberOfLines={1}
                lineHeight={14}
              >
                {habit.description}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        {/* Current-week dot strip (M T W T F S S) — parity with the card
            view's week strip so the list row reads the streak at a glance.
            `shrink={0}` keeps it from being squeezed by a long habit name;
            hidden below md where the row is too narrow to fit it. */}
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
            // Auto-fail only truly-missed scheduled days (no entry). Quota
            // habits never auto-fail. Mirrors the card view's dot logic.
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

        {/* Actions — card-consistent colours: green "Done" / muted "Skipped" /
            destructive "Failed" pill, OR the orange (habit-identity) Check-In
            button; then inline undo / skip / fail icon buttons and the overflow
            menu. Wrapped in a pointer-down guard so clicks reach the controls
            even when the row is a drag item in the kit `Sortable` — its kernel
            `setPointerCapture`s the wrapper on pointer-down and would otherwise
            swallow the click (this is why the /habits list menu didn't open). */}
        <XStack
          shrink={0}
          items="center"
          gap="$1.5"
          {...({
            onPointerDown: (e: { stopPropagation: () => void }) =>
              e.stopPropagation(),
          } as object)}
        >
          {statusLoading ? (
            <Skeleton width={72} height={28} rounded="$3" />
          ) : (
            <>
              {/* Burst is centred on the status/Complete control (not the whole
              row) — its rays emanate from the button the user tapped. */}
              <View position="relative" items="center" justify="center">
                <RadianceBurst active={completing} />
                {isComplete ? (
                  <XStack
                    items="center"
                    gap="$1.5"
                    rounded="$md"
                    px="$2.5"
                    py="$1.5"
                    bg="$successMuted"
                    transition="quick"
                    scale={bouncing ? 1.1 : 1}
                  >
                    <Text color="$success" lineHeight={0}>
                      <Check size={13} />
                    </Text>
                    <Text fontSize="$1" fontWeight="600" color="$success">
                      Done
                    </Text>
                  </XStack>
                ) : isSkipped ? (
                  <XStack
                    items="center"
                    gap="$1.5"
                    rounded="$md"
                    px="$2.5"
                    py="$1.5"
                    bg="$muted"
                  >
                    <Text color="$mutedForeground" lineHeight={0}>
                      <SkipForward size={12} />
                    </Text>
                    <Text
                      fontSize="$1"
                      fontWeight="600"
                      color="$mutedForeground"
                    >
                      Skipped
                    </Text>
                  </XStack>
                ) : isFailed ? (
                  <XStack
                    items="center"
                    gap="$1.5"
                    rounded="$md"
                    px="$2.5"
                    py="$1.5"
                    bg="$destructiveMuted"
                  >
                    <Text color="$destructive" lineHeight={0}>
                      <X size={12} />
                    </Text>
                    <Text fontSize="$1" fontWeight="600" color="$destructive">
                      Failed
                    </Text>
                  </XStack>
                ) : (
                  <Button
                    size="sm"
                    borderWidth={0}
                    color={"#ffffff" as never}
                    icon={<Check size={13} color="#ffffff" />}
                    style={{ backgroundColor: "var(--ring-habit)" }}
                    hoverStyle={
                      {
                        backgroundColor: "var(--ring-habit)",
                        opacity: 0.9,
                      } as never
                    }
                    pressStyle={
                      {
                        backgroundColor: "var(--ring-habit)",
                        opacity: 0.82,
                      } as never
                    }
                    onPress={handleCheckIn}
                    disabled={isSaving}
                    transition="quick"
                    scale={bouncing ? 1.1 : 1}
                  >
                    Complete
                  </Button>
                )}
              </View>

              {/* Inline undo / skip / fail — parity with the card view's actions. */}
              {isSkipped || isFailed ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleClearStatus}
                  disabled={isSaving}
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </IconButton>
              ) : null}
              {activeDateValue > 0 && !isSkipped && !isFailed ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleUndo}
                  disabled={isSaving}
                  aria-label="Undo last check-in"
                >
                  <Undo2 size={14} />
                </IconButton>
              ) : null}
              {activeDateValue === 0 && !isSkipped && !isFailed ? (
                <>
                  <IconButton
                    variant="outline"
                    size="sm"
                    onPress={handleSkip}
                    disabled={isSaving}
                    aria-label="Skip"
                  >
                    <SkipForward size={14} />
                  </IconButton>
                  <IconButton
                    variant="outline"
                    intent="danger"
                    size="sm"
                    onPress={handleFail}
                    disabled={isSaving}
                    aria-label="Mark failed"
                  >
                    <X size={14} />
                  </IconButton>
                </>
              ) : null}
            </>
          )}

          {/* Overflow menu — edit / move / archive / delete (skip/fail/undo are
              now inline, matching the card). */}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              {/* RippleButton (not IconButton): ripple press feedback instead of
                  a press-scale that would shift the menu's anchor as it opens. */}
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
              <DropdownMenu.Item
                intent="danger"
                onPress={() => setDeleteOpen(true)}
              >
                <DropdownMenu.Label>Delete</DropdownMenu.Label>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </XStack>
      </XStack>

      <EditHabitSheet
        habit={habit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* AlertDialog REQUIRES Portal + Overlay wrappers — without them
          the kit's `AlertDialog.Content` renders inline rather than as
          a modal overlay (see the kit's AlertDialog.tsx file header
          and the Tamagui v2 alert-dialog anatomy).

          Conditionally mounted so CLOSING UNMOUNTS the dialog (overlay removed
          instantly). The kit's exit-presence (<Animate presence> →
          onExitComplete) doesn't fire under this app's runtime-CSS setup
          (Tailwind coexistence forces disableExtraction, so the CSS driver's
          exit transitionend never lands) — closing via state alone left the
          scrim stuck. A full unmount, which the delete-mutation path already
          triggers, clears it reliably. */}
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
