import { useState } from "react";
import { Form } from "tamagui";
import {
  Button,
  EmojiPicker,
  Input,
  Label,
  NumberInput,
  Popover,
  Select,
  Text,
  TextArea,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Habit } from "@repo/core/types";

/**
 * The cross-platform shape of the habit-create / habit-edit form values.
 * Mirrors `Habit`'s editable fields. `scheduledDays` distinguishes "no
 * schedule" (an empty array — applies to every day) from "clear schedule"
 * (null — used by edit mutations to wipe a previously-set schedule), which
 * the host maps to its create vs. update mutation as appropriate.
 */
export interface HabitFormValues {
  name: string;
  description?: string;
  frequency: Habit["frequency"];
  targetCount: number;
  /**
   * `undefined`: leave unchanged / not set (create).
   * `[]`: explicitly "no specific days" (every day).
   * `[0..6]`: weekday numbers; mapped to API's scheduled-days payload.
   * Hosts normalize `frequency !== "weekly"` to clear this server-side.
   */
  scheduledDays?: number[];
  weeklyTarget?: number;
  unit?: string;
  color: string;
  icon?: string;
}

/** The default seed for a brand-new habit (create flow). */
export const HABIT_FORM_DEFAULTS: HabitFormValues = {
  name: "",
  description: "",
  frequency: "daily",
  targetCount: 1,
  scheduledDays: [],
  weeklyTarget: 2,
  unit: "",
  color: "#3b82f6",
  icon: "🎯",
};

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#78716c", label: "Stone" },
];

export interface HabitFormProps {
  /** Initial values to seed the form with. */
  initial: HabitFormValues;
  /** Submit-button text in the resting state ("Create", "Save"). */
  submitLabel: string;
  /** Submit-button text while the host's mutation is in-flight. */
  submittingLabel: string;
  /** Disables the submit button + shows the inline spinner. */
  isSubmitting?: boolean;
  /**
   * Category-identity color for the submit button. On web pass
   * `var(--ring-habit)`; on native pass the resolved hex from
   * `RING_CATEGORY.habit.color` (kept symmetric with `HabitCard`).
   */
  accentColor: string;
  /** Fired on form submit when the name is non-empty. */
  onSubmit: (values: HabitFormValues) => void | Promise<void>;
  /** Fired on Cancel press (or whatever close gesture the host wires up). */
  onCancel: () => void;
}

/**
 * Cross-platform habit form — shared by the PWA's create dialog + edit
 * sheet (and the future mobile equivalents). Pure presentational +
 * controlled fields; the host owns the surrounding chrome (Dialog,
 * Sheet, modal, full-screen page) and the create/update mutation.
 *
 * The host re-mounts this component (typically via `key={open}`) when
 * the form should be reset — the form itself never auto-resets, so
 * "reset on close" stays a host concern.
 *
 * Cross-platform notes:
 *  - `<Form>` from tamagui gives us native Enter-to-submit on web + the
 *    same trigger semantics on native via `Form.Trigger`.
 *  - Kit `EmojiPicker` is backed by a truly cross-platform picker
 *    (`@hiraku-ai/react-native-emoji-picker`); no platform-split needed.
 *  - All chrome (Popover, Select, ToggleGroup, NumberInput, Input,
 *    TextArea, Label) is from the kit and runs on both targets.
 */
export function HabitForm({
  initial,
  submitLabel,
  submittingLabel,
  isSubmitting,
  accentColor,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [frequency, setFrequency] = useState<HabitFormValues["frequency"]>(
    initial.frequency,
  );
  const [targetCount, setTargetCount] = useState(initial.targetCount);
  const [unit, setUnit] = useState(initial.unit ?? "");
  const [color, setColor] = useState(initial.color);
  const [icon, setIcon] = useState(initial.icon ?? "");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [scheduledDays, setScheduledDays] = useState<number[]>(
    initial.scheduledDays ?? [],
  );
  const [weeklyTarget, setWeeklyTarget] = useState(initial.weeklyTarget ?? 2);

  function handleSubmit() {
    if (!name.trim()) return;
    void onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      frequency,
      targetCount,
      scheduledDays:
        frequency === "weekly" && scheduledDays.length > 0
          ? scheduledDays
          : undefined,
      weeklyTarget: frequency === "weekly_target" ? weeklyTarget : undefined,
      unit: unit.trim() || undefined,
      color,
      icon: icon || undefined,
    });
  }

  return (
    <Form onSubmit={handleSubmit}>
      <YStack gap="$4">
        <XStack gap="$2">
          <YStack>
            <Text fontSize="$3" fontWeight="500" color="$color">
              Icon
            </Text>
            <View mt="$1">
              <Popover
                open={iconPickerOpen}
                onOpenChange={setIconPickerOpen}
                placement="bottom-start"
              >
                <Popover.Trigger asChild>
                  <View
                    role="button"
                    aria-label="Pick an icon"
                    cursor="pointer"
                    height={40}
                    width={40}
                    shrink={0}
                    items="center"
                    justify="center"
                    rounded="$lg"
                    borderWidth={1}
                    borderColor="$borderColor"
                    bg="$background"
                    hoverStyle={{ bg: "$accent" }}
                  >
                    <Text fontSize="$6" color="$color">
                      {icon || "😀"}
                    </Text>
                  </View>
                </Popover.Trigger>
                <Popover.Content
                  z={200}
                  width="auto"
                  p={0}
                  borderWidth={0}
                  overflow="hidden"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
                >
                  <EmojiPicker
                    width={350}
                    height={400}
                    onSelect={(emoji) => {
                      setIcon(emoji);
                      setIconPickerOpen(false);
                    }}
                  />
                </Popover.Content>
              </Popover>
            </View>
          </YStack>
          <YStack flex={1}>
            <Label htmlFor="habit-form-name">Name</Label>
            <Input
              id="habit-form-name"
              mt="$1"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Read for 30 minutes"
              autoFocus
            />
          </YStack>
        </XStack>

        <YStack>
          <Label htmlFor="habit-form-description">Description</Label>
          <TextArea
            id="habit-form-description"
            mt="$1"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details"
            rows={2}
          />
        </YStack>

        <XStack gap="$4">
          <YStack flex={1}>
            <Label htmlFor="habit-form-frequency">Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(value) => {
                setFrequency(value as HabitFormValues["frequency"]);
                if (value !== "weekly") setScheduledDays([]);
              }}
            >
              <Select.Trigger mt="$1" width="100%" />
              <Select.Content>
                <Select.Item value="daily">Daily</Select.Item>
                <Select.Item value="weekly">Specific days</Select.Item>
                <Select.Item value="weekly_target">Times per week</Select.Item>
              </Select.Content>
            </Select>
          </YStack>
          <YStack width={120}>
            <Label htmlFor="habit-form-target">
              {frequency === "weekly_target" ? "Per session" : "Times per day"}
            </Label>
            <Input
              id="habit-form-target"
              mt="$1"
              keyboardType="number-pad"
              value={String(targetCount)}
              onChangeText={(text) => setTargetCount(Number(text) || 1)}
            />
          </YStack>
          <YStack flex={1}>
            <Label htmlFor="habit-form-unit">Unit</Label>
            <Input
              id="habit-form-unit"
              mt="$1"
              value={unit}
              onChangeText={setUnit}
              placeholder="e.g. minutes"
            />
          </YStack>
        </XStack>

        {frequency === "weekly" && (
          <YStack>
            <Text fontSize="$3" fontWeight="500" color="$color">
              Days
            </Text>
            <ToggleGroup
              type="multiple"
              mt="$2"
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
          </YStack>
        )}

        {frequency === "weekly_target" && (
          <YStack>
            <Label>Times per week</Label>
            <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
              Do it this many times a week, on any days.
            </Text>
            <XStack mt="$2" items="center" gap="$2">
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
          </YStack>
        )}

        <YStack>
          <Text fontSize="$3" fontWeight="500" color="$color">
            Color
          </Text>
          <XStack mt="$2" gap="$2">
            {COLOR_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                role="button"
                aria-pressed={color === opt.value}
                aria-label={opt.label}
                onPress={() => setColor(opt.value)}
                cursor="pointer"
                height={28}
                width={28}
                rounded={9999}
                borderWidth={2}
                borderColor={color === opt.value ? "$color" : "transparent"}
                transition="quick"
                scale={color === opt.value ? 1.1 : 1}
                style={{ backgroundColor: opt.value }}
              />
            ))}
          </XStack>
        </YStack>

        <XStack justify="flex-end" gap="$3" pt="$2">
          <Button intent="outline" type="button" onPress={onCancel}>
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
              borderWidth={0}
              color={"#ffffff" as never}
              style={{ backgroundColor: accentColor }}
              hoverStyle={
                { backgroundColor: accentColor, opacity: 0.9 } as never
              }
              pressStyle={
                { backgroundColor: accentColor, opacity: 0.82 } as never
              }
              disabled={!name.trim() || isSubmitting}
              loading={isSubmitting}
              loadingText={submittingLabel}
            >
              {submitLabel}
            </Button>
          </Form.Trigger>
        </XStack>
      </YStack>
    </Form>
  );
}
