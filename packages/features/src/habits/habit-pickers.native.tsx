// packages/features/src/habits/habit-pickers.native.tsx  (NATIVE)
//
// The habit attribute pickers — Frequency (every day / specific days / times
// per week, as direct rows with inline controls), Target (count + unit) and
// Color — as small sibling Sheets, plus the
// day/colour constants they share. Used by BOTH the quick-add (create) sheet
// and the detail (edit) sheet so the two flows pick from the identical UI
// (extracted from quick-add-habit-sheet.native.tsx, 2026-10-21).
import { Input, Sheet, Text, View, XStack, YStack } from "@stageholder/ui";
import type { HabitFormValues } from "./habit-form";

// Kept in sync with habit-form.tsx (stable brand constants). Verbatim values —
// Mon-first day order, the 9-swatch habit palette.
export const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

export const COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#78716c", label: "Stone" },
] as const;

export const NO_GROUP_VALUE = "__none__";

// ── nested picker sheets ────────────────────────────────────────────────────

/** Pill label for the current frequency — "Every day", "Mon, Wed, Fri",
 *  "Specific days" (none chosen yet) or "3× / week". Shared by the create
 *  and edit sheets so the pill always reads the same. */
export function frequencyLabel(
  frequency: HabitFormValues["frequency"],
  scheduledDays: number[],
  weeklyTarget: number,
): string {
  if (frequency === "weekly") {
    if (scheduledDays.length === 0) return "Specific days";
    if (scheduledDays.length === 7) return "Every day";
    return DAY_OPTIONS.filter((d) => scheduledDays.includes(d.value))
      .map((d) => d.label)
      .join(", ");
  }
  if (frequency === "weekly_target") return `${weeklyTarget}× / week`;
  return "Every day";
}

const FREQUENCY_OPTIONS: ReadonlyArray<{
  value: HabitFormValues["frequency"];
  label: string;
  hint: string;
}> = [
  { value: "daily", label: "Every day", hint: "Check in once a day." },
  { value: "weekly", label: "Specific days", hint: "Pick the days it counts." },
  {
    value: "weekly_target",
    label: "Times per week",
    hint: "Any days, hit a weekly number.",
  },
];

/**
 * Frequency picker: the three options are rows you tap directly (the earlier
 * version put a Select dropdown inside the sheet, so choosing meant opening a
 * picker inside a picker). "Every day" commits and closes; the other two stay
 * open and reveal their controls inline — weekday chips, or a −/+ stepper —
 * then Done (or the overlay) closes. Every tappable is a Tamagui View/XStack
 * `onPress`: the kit's RN-Pressable controls get no touches inside a nested
 * sheet on native.
 */
export function FrequencyPickerSheet({
  open,
  onOpenChange,
  frequency,
  setFrequency,
  scheduledDays,
  setScheduledDays,
  weeklyTarget,
  setWeeklyTarget,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  frequency: HabitFormValues["frequency"];
  setFrequency: (f: HabitFormValues["frequency"]) => void;
  scheduledDays: number[];
  setScheduledDays: (d: number[]) => void;
  weeklyTarget: number;
  setWeeklyTarget: (n: number) => void;
}) {
  const choose = (v: HabitFormValues["frequency"]) => {
    setFrequency(v);
    if (v !== "weekly") setScheduledDays([]);
    if (v === "daily") onOpenChange(false);
  };
  const toggleDay = (day: number) => {
    const next = scheduledDays.includes(day)
      ? scheduledDays.filter((d) => d !== day)
      : [...scheduledDays, day];
    setScheduledDays(next.sort((a, b) => a - b));
  };
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$1">
        <XStack items="center" justify="space-between" pb="$2">
          <Text fontSize="$5" fontWeight="600" color="$color">
            Frequency
          </Text>
          <View
            role="button"
            aria-label="Done"
            px="$3"
            py="$1.5"
            rounded="$2"
            pressStyle={{ bg: "$secondary" }}
            onPress={() => onOpenChange(false)}
          >
            <Text fontSize="$3" fontWeight="600" color="$primary">
              Done
            </Text>
          </View>
        </XStack>

        {FREQUENCY_OPTIONS.map((o) => {
          const active = frequency === o.value;
          return (
            <YStack key={o.value} gap="$2">
              <XStack
                role="button"
                aria-label={o.label}
                onPress={() => choose(o.value)}
                items="center"
                gap="$3"
                py="$2.5"
                px="$2"
                rounded="$3"
                bg={active ? "$secondary" : "transparent"}
                pressStyle={{ bg: "$secondary" }}
              >
                <View
                  width={18}
                  height={18}
                  rounded={9999}
                  borderWidth={2}
                  borderColor={active ? "$primary" : "$borderColor"}
                  items="center"
                  justify="center"
                >
                  {active ? (
                    <View width={8} height={8} rounded={9999} bg="$primary" />
                  ) : null}
                </View>
                <YStack flex={1} minW={0}>
                  <Text fontSize="$4" color="$color">
                    {o.label}
                  </Text>
                  <Text fontSize="$2" color="$mutedForeground">
                    {o.hint}
                  </Text>
                </YStack>
              </XStack>

              {active && o.value === "weekly" ? (
                <XStack gap="$1.5" px="$2" pb="$2">
                  {DAY_OPTIONS.map((day) => {
                    const on = scheduledDays.includes(day.value);
                    return (
                      <View
                        key={day.value}
                        role="button"
                        aria-label={day.label}
                        aria-selected={on}
                        flex={1}
                        height={40}
                        items="center"
                        justify="center"
                        rounded="$3"
                        borderWidth={1}
                        borderColor={on ? "$primary" : "$borderColor"}
                        bg={on ? "$primary" : "transparent"}
                        pressStyle={{ bg: on ? "$primary" : "$secondary" }}
                        onPress={() => toggleDay(day.value)}
                      >
                        <Text
                          fontSize="$2"
                          fontWeight={on ? "600" : "400"}
                          color={on ? "$primaryForeground" : "$color"}
                        >
                          {day.label}
                        </Text>
                      </View>
                    );
                  })}
                </XStack>
              ) : null}

              {active && o.value === "weekly_target" ? (
                <XStack items="center" gap="$3" px="$2" pb="$2">
                  <StepButton
                    label="−"
                    ariaLabel="Fewer times per week"
                    disabled={weeklyTarget <= 1}
                    onPress={() =>
                      setWeeklyTarget(Math.max(1, weeklyTarget - 1))
                    }
                  />
                  <Text
                    fontSize="$6"
                    fontWeight="600"
                    color="$color"
                    minW={56}
                    text="center"
                  >
                    {weeklyTarget}
                  </Text>
                  <StepButton
                    label="+"
                    ariaLabel="More times per week"
                    disabled={weeklyTarget >= 7}
                    onPress={() =>
                      setWeeklyTarget(Math.min(7, weeklyTarget + 1))
                    }
                  />
                  <Text fontSize="$3" color="$mutedForeground">
                    times a week
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          );
        })}
      </Sheet.Frame>
    </Sheet>
  );
}

function StepButton({
  label,
  ariaLabel,
  disabled,
  onPress,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      width={44}
      height={44}
      rounded={9999}
      borderWidth={1}
      borderColor="$borderColor"
      items="center"
      justify="center"
      opacity={disabled ? 0.4 : 1}
      pressStyle={{ bg: "$secondary" }}
      onPress={() => {
        if (!disabled) onPress();
      }}
    >
      <Text fontSize="$6" color="$color">
        {label}
      </Text>
    </View>
  );
}

export function TargetPickerSheet({
  open,
  onOpenChange,
  frequency,
  targetCount,
  setTargetCount,
  unit,
  setUnit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  frequency: HabitFormValues["frequency"];
  targetCount: number;
  setTargetCount: (n: number) => void;
  unit: string;
  setUnit: (s: string) => void;
}) {
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$3">
        <Text fontSize="$5" fontWeight="600" color="$color">
          {frequency === "weekly_target" ? "Per session" : "Times per day"}
        </Text>
        <XStack gap="$3">
          <Input
            flex={1}
            keyboardType="number-pad"
            value={String(targetCount)}
            onChangeText={(t) => setTargetCount(Number(t) || 1)}
          />
          <Input
            flex={1}
            value={unit}
            onChangeText={setUnit}
            placeholder="Unit (e.g. minutes)"
          />
        </XStack>
      </Sheet.Frame>
    </Sheet>
  );
}

export function ColorPickerSheet({
  open,
  onOpenChange,
  color,
  setColor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  color: string;
  setColor: (c: string) => void;
}) {
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$3">
        <Text fontSize="$5" fontWeight="600" color="$color">
          Color
        </Text>
        <XStack gap="$3" flexWrap="wrap">
          {COLOR_OPTIONS.map(({ value: swatch, label }) => (
            <View
              key={swatch}
              role="button"
              aria-pressed={color === swatch}
              aria-label={label}
              onPress={() => {
                setColor(swatch);
                onOpenChange(false);
              }}
              height={32}
              width={32}
              rounded={9999}
              borderWidth={2}
              borderColor={color === swatch ? "$color" : "transparent"}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </XStack>
      </Sheet.Frame>
    </Sheet>
  );
}
