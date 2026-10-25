// apps/mobile/components/habit-day-sheet.tsx
//
// The habit detail's "edit a day" actions as a bottom sheet. Tapping a day on
// the month grid opens this with the chosen date, its state for this habit
// (done / partial / skipped / failed / rest day / not recorded) and the
// actions that apply — Record, Undo, Skip, Fail, clear — as full-width rows.
// Replaces the small panel that used to sit under the calendar: a tap at the
// top of the grid changed something far below the fold, so the user never
// saw which day they were editing (device feedback 2026-10-25).
//
// Every tappable is a Tamagui `XStack` with `onPress` — the pattern proven
// inside the app's sheets (kit RN-Pressable buttons miss touches in portaled
// sheets on Android). Colours follow the habit check-in row: the accent
// (habit orange) for Record, destructive red for Fail, muted for Skip/Undo.

import type { ReactNode } from "react";
import { format, getDay } from "date-fns";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Minus } from "@tamagui/lucide-icons-2/icons/Minus";
import { RotateCcw } from "@tamagui/lucide-icons-2/icons/RotateCcw";
import { SkipForward } from "@tamagui/lucide-icons-2/icons/SkipForward";
import { X } from "@tamagui/lucide-icons-2/icons/X";
import { Sheet, Spinner, Text, View, XStack, YStack } from "@stageholder/ui";
import type { Habit, HabitEntry } from "@repo/core/types";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";

import { IGNITION } from "@/lib/ignition-palette";

function parseDateLocal(input: string): Date {
  return new Date(input + "T00:00:00");
}

export interface HabitDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `yyyy-MM-dd` of the tapped day; `null` renders nothing. */
  date: string | null;
  today: string;
  habit: Habit;
  /** Weekly-target habit: no per-day Skip/Fail (quota, not schedule). */
  isQuota: boolean;
  /** Any day mutation (or the month fetch) in flight — rows disable. */
  isMutating: boolean;
  entry: { value: number; type?: string } | undefined;
  entryObj: HabitEntry | undefined;
  onCheckIn: (d: string) => void;
  onUndo: (d: string) => void;
  onSkip: (d: string) => void;
  onFail: (d: string) => void;
  onClear: (d: string) => void;
}

export function HabitDaySheet({
  open,
  onOpenChange,
  date,
  today,
  habit,
  isQuota,
  isMutating,
  entry,
  entryObj,
  onCheckIn,
  onUndo,
  onSkip,
  onFail,
  onClear,
}: HabitDaySheetProps) {
  const value = entry?.value ?? 0;
  const skipped = entry?.type === "skip";
  const failed = entry?.type === "fail";
  const target = entryObj
    ? resolveTargetCount(entryObj, habit)
    : habit.targetCount;
  const complete = !skipped && !failed && target > 0 && value >= target;
  const hasSchedule = !!habit.scheduledDays && habit.scheduledDays.length > 0;
  const scheduled =
    !date ||
    !hasSchedule ||
    habit.scheduledDays!.includes(getDay(parseDateLocal(date)));
  const future = !!date && date > today;

  const status = failed
    ? "Failed — streak reset"
    : skipped
      ? "Skipped"
      : complete
        ? target > 1
          ? `Done · ${value}/${target}`
          : "Done"
        : value > 0
          ? `In progress · ${value}/${target}`
          : future
            ? "Not yet"
            : "Not recorded";
  const statusColor = failed
    ? "$destructive"
    : complete
      ? "$success"
      : "$mutedForeground";

  const close = () => onOpenChange(false);
  const run = (fn: (d: string) => void) => {
    if (!date || isMutating) return;
    fn(date);
  };

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$3">
        {date ? (
          <>
            <YStack gap="$1" pb="$1">
              <Text fontSize="$6" fontWeight="600" color="$color">
                {format(parseDateLocal(date), "EEEE, MMM d")}
              </Text>
              <XStack items="center" gap="$2">
                <Text fontSize="$3" fontWeight="500" color={statusColor}>
                  {status}
                </Text>
                {!scheduled ? (
                  <Text fontSize="$3" color="$mutedForeground">
                    · Rest day
                  </Text>
                ) : null}
                {isMutating ? <Spinner size="small" /> : null}
              </XStack>
            </YStack>

            <YStack gap="$2">
              {!complete && !future ? (
                <ActionRow
                  label={
                    skipped || failed
                      ? "Record instead"
                      : target > 1
                        ? `Record ${value + 1} / ${target}`
                        : "Record"
                  }
                  hint={
                    skipped || failed
                      ? "Clears the status and counts the day"
                      : "Counts this day toward the habit"
                  }
                  icon={<Check size={18} color="#ffffff" />}
                  tone="accent"
                  disabled={isMutating}
                  onPress={() => run(onCheckIn)}
                />
              ) : null}
              {complete || (value > 0 && !skipped && !failed) ? (
                <ActionRow
                  label={
                    value > 1 ? `Undo one (${value - 1} / ${target})` : "Undo"
                  }
                  hint="Removes the last check-in for this day"
                  icon={<RotateCcw size={18} color="$color" />}
                  tone="neutral"
                  disabled={isMutating}
                  onPress={() => run(onUndo)}
                />
              ) : null}
              {skipped || failed ? (
                <ActionRow
                  label={failed ? "Clear fail" : "Clear skip"}
                  hint="Back to an unrecorded day"
                  icon={<RotateCcw size={18} color="$color" />}
                  tone="neutral"
                  disabled={isMutating}
                  onPress={() => run(onClear)}
                />
              ) : null}
              {!isQuota &&
              !complete &&
              !skipped &&
              !failed &&
              !future &&
              scheduled ? (
                <>
                  <ActionRow
                    label="Skip"
                    hint="A rest day — keeps the streak"
                    icon={<SkipForward size={18} color="$color" />}
                    tone="neutral"
                    disabled={isMutating}
                    onPress={() => run(onSkip)}
                  />
                  <ActionRow
                    label="Mark failed"
                    hint="Breaks the streak on this day"
                    icon={<X size={18} color="$destructive" />}
                    tone="destructive"
                    disabled={isMutating}
                    onPress={() => run(onFail)}
                  />
                </>
              ) : null}
              {future ? (
                <XStack items="center" gap="$2" py="$2">
                  <Minus size={14} color="$mutedForeground" />
                  <Text fontSize="$3" color="$mutedForeground">
                    This day hasn't come yet.
                  </Text>
                </XStack>
              ) : null}
            </YStack>

            <View
              role="button"
              aria-label="Close"
              items="center"
              py="$2.5"
              rounded="$4"
              pressStyle={{ bg: "$secondary" }}
              onPress={close}
            >
              <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
                Close
              </Text>
            </View>
          </>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}

function ActionRow({
  label,
  hint,
  icon,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  tone: "accent" | "neutral" | "destructive";
  disabled?: boolean;
  onPress: () => void;
}) {
  const accent = tone === "accent";
  return (
    <XStack
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      items="center"
      gap="$3"
      px="$3"
      py="$2.5"
      rounded="$4"
      borderWidth={accent ? 0 : 1}
      borderColor={tone === "destructive" ? "$destructive" : "$borderColor"}
      opacity={disabled ? 0.5 : 1}
      style={accent ? { backgroundColor: IGNITION.habit.base } : undefined}
      pressStyle={{ opacity: 0.75 }}
      onPress={() => {
        if (!disabled) onPress();
      }}
    >
      <View
        width={34}
        height={34}
        rounded={9999}
        items="center"
        justify="center"
        bg={accent ? "transparent" : "$secondary"}
        style={
          accent ? { backgroundColor: "rgba(255,255,255,0.22)" } : undefined
        }
      >
        {icon}
      </View>
      <YStack flex={1} minW={0}>
        <Text
          fontSize="$4"
          fontWeight="600"
          color={
            accent
              ? ("#ffffff" as never)
              : tone === "destructive"
                ? "$destructive"
                : "$color"
          }
        >
          {label}
        </Text>
        <Text
          fontSize="$2"
          color={
            accent ? ("rgba(255,255,255,0.8)" as never) : "$mutedForeground"
          }
        >
          {hint}
        </Text>
      </YStack>
    </XStack>
  );
}
