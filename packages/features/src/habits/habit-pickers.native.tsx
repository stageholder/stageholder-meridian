// packages/features/src/habits/habit-pickers.native.tsx  (NATIVE)
//
// The habit attribute pickers — Frequency (daily / specific days / times per
// week), Target (count + unit) and Color — as small sibling Sheets, plus the
// day/colour constants they share. Used by BOTH the quick-add (create) sheet
// and the detail (edit) sheet so the two flows pick from the identical UI
// (extracted from quick-add-habit-sheet.native.tsx, 2026-10-21).
import {
  Input,
  NumberInput,
  Select,
  Sheet,
  Text,
  ToggleGroup,
  View,
  XStack,
} from "@stageholder/ui";
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
          Frequency
        </Text>
        <Select
          value={frequency}
          onValueChange={(v) => {
            setFrequency(v as HabitFormValues["frequency"]);
            if (v !== "weekly") setScheduledDays([]);
          }}
          inSheet
        >
          <Select.Trigger width="100%" />
          <Select.Content>
            <Select.Item value="daily">Daily</Select.Item>
            <Select.Item value="weekly">Specific days</Select.Item>
            <Select.Item value="weekly_target">Times per week</Select.Item>
          </Select.Content>
        </Select>

        {frequency === "weekly" ? (
          <ToggleGroup
            type="multiple"
            value={scheduledDays.map(String)}
            onValueChange={(vals: string[]) =>
              setScheduledDays(vals.map(Number).sort((a, b) => a - b))
            }
          >
            {DAY_OPTIONS.map((day) => (
              <ToggleGroup.Item
                key={day.value}
                value={String(day.value)}
                aria-label={day.label}
              >
                <Text>{day.label}</Text>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup>
        ) : null}

        {frequency === "weekly_target" ? (
          <XStack items="center" gap="$2">
            <NumberInput
              value={weeklyTarget}
              onChange={setWeeklyTarget}
              min={1}
              max={7}
              step={1}
            />
            <Text fontSize="$3" color="$mutedForeground">
              × / week
            </Text>
          </XStack>
        ) : null}
      </Sheet.Frame>
    </Sheet>
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
