import { useState } from "react";
import { format, subDays } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { Check, MoreHorizontal, Target } from "lucide-react";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  RippleButton,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
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

  const { data: entries } = useHabitEntries(habit.id, {
    startDate: ninetyDaysAgo,
    endDate: today,
  });

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabitEntry();
  const failEntry = useFailHabitEntry();
  const deleteHabit = useDeleteHabit();
  const toast = useToast();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const targetCount = habit.targetCount ?? 1;
  const isComplete = activeDateValue >= targetCount;
  const isSkipped = activeDateEntry?.type === "skip";
  const isFailed = activeDateEntry?.type === "fail";

  const dateLabel = isViewingToday
    ? habit.name
    : `${habit.name} (${activeDate})`;

  const isPending =
    createEntry.isPending ||
    updateEntry.isPending ||
    skipEntry.isPending ||
    failEntry.isPending;

  async function handleCheckIn() {
    if (isComplete || isPending) return;
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
      toast.show({ title: `Checked in for ${dateLabel}`, intent: "success" });
    } catch {
      toast.show({ title: "Failed to check in", intent: "danger" });
    }
  }

  async function handleSkip() {
    if (isComplete || isSkipped || isPending) return;
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
      toast.show({ title: `Skipped ${habit.name}`, intent: "success" });
    } catch {
      toast.show({ title: "Failed to skip", intent: "danger" });
    }
  }

  async function handleFail() {
    if (isComplete || isFailed || isPending) return;
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
      toast.show({ title: `Marked ${habit.name} failed`, intent: "success" });
    } catch {
      toast.show({ title: "Failed to update", intent: "danger" });
    }
  }

  async function handleUndo() {
    if (activeDateValue <= 0 || isPending) return;
    if (!activeDateEntry) return;
    try {
      await updateEntry.mutateAsync({
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { value: activeDateValue - 1 },
      });
      toast.show({
        title: `Undid check-in for ${habit.name}`,
        intent: "success",
      });
    } catch {
      toast.show({ title: "Failed to undo", intent: "danger" });
    }
  }

  async function handleClearStatus() {
    if (!activeDateEntry || isPending) return;
    try {
      await updateEntry.mutateAsync({
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { type: "completion", value: 0 },
      });
      toast.show({ title: `Cleared ${habit.name}`, intent: "success" });
    } catch {
      toast.show({ title: "Failed to undo", intent: "danger" });
    }
  }

  function handleDelete() {
    deleteHabit.mutate(habit.id, {
      onSuccess: () =>
        toast.show({ title: `"${habit.name}" deleted`, intent: "success" }),
      onError: () =>
        toast.show({ title: "Failed to delete habit", intent: "danger" }),
    });
    setDeleteOpen(false);
  }

  // Today-status pill copy + colour token. Three distinct visual states
  // so the row is scannable at a glance without needing the dot strip
  // the card view uses.
  const statusLabel = isComplete
    ? "Done"
    : isSkipped
      ? "Skipped"
      : isFailed
        ? "Failed"
        : null;
  const statusColor = isComplete
    ? "$primary"
    : isSkipped
      ? "$mutedForeground"
      : isFailed
        ? "$destructive"
        : null;

  return (
    <>
      <XStack
        items="center"
        gap="$3"
        py="$3"
        px="$3.5"
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
            {habit.icon ? (
              <Text fontSize="$5">{habit.icon}</Text>
            ) : (
              <Text color={"var(--ring-habit)" as never} lineHeight={0}>
                <Target size={16} />
              </Text>
            )}
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

        {/* Single status/action slot — collapses three previously
            separate visual elements (status pill, complete button,
            done button) into one. Three states, three treatments:
              · complete    → check pill with brand colour
              · skip / fail → muted/destructive outline pill
              · pending     → primary "Complete" action button         */}
        {isComplete ? (
          <XStack
            shrink={0}
            items="center"
            gap="$1.5"
            px="$2.5"
            py="$1.5"
            rounded="$3"
            borderWidth={1}
            borderColor="$primary"
          >
            <Text color="$primary" lineHeight={0}>
              <Check size={13} />
            </Text>
            <Text fontSize="$1" fontWeight="500" color="$primary">
              Done
            </Text>
          </XStack>
        ) : statusLabel ? (
          <View
            shrink={0}
            px="$2.5"
            py="$1.5"
            rounded="$3"
            borderWidth={1}
            borderColor={statusColor as never}
          >
            <Text fontSize="$1" fontWeight="500" color={statusColor as never}>
              {statusLabel}
            </Text>
          </View>
        ) : (
          <Button
            size="sm"
            intent="primary"
            onPress={handleCheckIn}
            disabled={isPending}
          >
            Complete
          </Button>
        )}

        {/* Overflow menu — same affordances as the card-view menu so
            users get parity across modes. Matches the card view's
            DropdownMenu API: `onPress` (not `onSelect`), `intent="danger"`
            for the destructive action, `<DropdownMenu.Label>` for text. */}
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
            {activeDateValue > 0 && !isComplete ? (
              <DropdownMenu.Item onPress={handleUndo}>
                <DropdownMenu.Label>Undo last</DropdownMenu.Label>
              </DropdownMenu.Item>
            ) : null}
            {isSkipped || isFailed ? (
              <DropdownMenu.Item onPress={handleClearStatus}>
                <DropdownMenu.Label>Clear status</DropdownMenu.Label>
              </DropdownMenu.Item>
            ) : null}
            {!isComplete && !isSkipped ? (
              <DropdownMenu.Item onPress={handleSkip}>
                <DropdownMenu.Label>Skip today</DropdownMenu.Label>
              </DropdownMenu.Item>
            ) : null}
            {!isComplete && !isFailed ? (
              <DropdownMenu.Item onPress={handleFail}>
                <DropdownMenu.Label>Mark failed</DropdownMenu.Label>
              </DropdownMenu.Item>
            ) : null}
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
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
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
          </AlertDialog.Portal>
        </AlertDialog>
      )}
    </>
  );
}
