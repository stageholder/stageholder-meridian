// packages/features/src/habits/quick-add-habit-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a habit on native. Icon + name
// on top; everything else is a pill with a default, so a name alone can create.
// Recomposes the proven HabitForm controls (MediaPickerSheet, Select, Input,
// ToggleGroup, NumberInput, color swatches) into the QuickAddSheet shell — the
// heavier sub-config (weekly days, target+unit, color) lives in small nested
// picker sheets. Create-only; EDIT keeps the full HabitForm.
import { useEffect, useRef, useState } from "react";
import type { TextInput } from "react-native";
import {
  Folder,
  Repeat,
  Smile,
  StickyNote,
  Target,
} from "@tamagui/lucide-icons-2";
import {
  Input,
  MediaGlyph,
  MediaPickerSheet,
  NumberInput,
  Select,
  Sheet,
  Text,
  ToggleGroup,
  View,
  XStack,
  type MediaValue,
} from "@stageholder/ui";
import {
  QuickAddSheet,
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
import { encodeMediaIcon, parseMediaIcon } from "./icon-value";
import { HABIT_FORM_DEFAULTS, type HabitFormValues } from "./habit-form";
import type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.types";

// Kept in sync with habit-form.tsx (stable brand constants). Verbatim values —
// Mon-first day order, the 9-swatch habit palette.
const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

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
] as const;

const NO_GROUP_VALUE = "__none__";

// ── nested picker sheets ────────────────────────────────────────────────────

function FrequencyPickerSheet({
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

function TargetPickerSheet({
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

function ColorPickerSheet({
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

// ── main sheet ──────────────────────────────────────────────────────────────

export function QuickAddHabitSheet({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  accentColor,
  isSubmitting,
  onSubmit,
}: QuickAddHabitSheetProps) {
  const hasGroups = !!groups && groups.length > 0;
  const nameRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [icon, setIcon] = useState(HABIT_FORM_DEFAULTS.icon ?? "🎯");
  const [frequency, setFrequency] =
    useState<HabitFormValues["frequency"]>("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [weeklyTarget, setWeeklyTarget] = useState(2);
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState(HABIT_FORM_DEFAULTS.color);
  const [groupId, setGroupId] = useState<string | null>(defaultGroupId ?? null);

  const [iconOpen, setIconOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  // Reset by STATE on each fresh open (open false→true) — no remount key.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName("");
      setDescription("");
      setNoteOpen(false);
      setIcon(HABIT_FORM_DEFAULTS.icon ?? "🎯");
      setFrequency("daily");
      setTargetCount(1);
      setScheduledDays([]);
      setWeeklyTarget(2);
      setUnit("");
      setColor(HABIT_FORM_DEFAULTS.color);
      setGroupId(defaultGroupId ?? null);
      setTimeout(() => nameRef.current?.focus(), 350);
    }
    wasOpen.current = open;
  }, [open, defaultGroupId]);

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
      // Only thread groupId when the picker is shown (parity with HabitForm).
      ...(hasGroups ? { groupId } : {}),
    });
  }

  // Keep-keyboard-up: a picker sheet dismisses the keyboard to open; refocus
  // the name after it closes so the composer returns to its keyboard-up state
  // (kit FormSheet MixedFieldsDemo pattern; the delay yields to the close anim).
  const refocus = () => setTimeout(() => nameRef.current?.focus(), 300);

  const handlePickIcon = (value: MediaValue | null) => {
    setIcon(encodeMediaIcon(value) ?? "");
    setIconOpen(false);
    refocus();
  };

  const freqLabel =
    frequency === "daily"
      ? "Every day"
      : frequency === "weekly"
        ? "Specific days"
        : "Times / week";
  const targetLabel = `${targetCount}×${unit.trim() ? ` ${unit.trim()}` : ""}`;
  const activeGroupName = groups?.find((g) => g.id === groupId)?.name;
  const groupOptions: PillPickerOption[] = [
    { value: NO_GROUP_VALUE, label: "Ungrouped" },
    ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ];

  return (
    <>
      <QuickAddSheet
        open={open}
        onOpenChange={onOpenChange}
        title="New Habit"
        accentColor={accentColor}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
        submitDisabled={!name.trim()}
        field={
          <>
            <XStack gap="$2" items="center">
              <View
                role="button"
                aria-label="Pick an icon"
                onPress={() => setIconOpen(true)}
                width={40}
                height={40}
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                justify="center"
              >
                <MediaGlyph
                  value={parseMediaIcon(icon)}
                  size={22}
                  fallback={<Smile size={20} color="$mutedForeground" />}
                />
              </View>
              <Input
                flex={1}
                ref={nameRef as never}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Read for 30 minutes"
              />
            </XStack>
            {noteOpen ? (
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Add note…"
              />
            ) : null}
          </>
        }
        pills={
          <>
            <QuickAddPill
              icon={<Repeat size={13} />}
              label={freqLabel}
              onPress={() => setFreqOpen(true)}
            />
            <QuickAddPill
              icon={<Target size={13} />}
              label={targetLabel}
              onPress={() => setTargetOpen(true)}
            />
            <QuickAddPill
              icon={
                <View
                  width={12}
                  height={12}
                  rounded={9999}
                  style={{ backgroundColor: color }}
                />
              }
              label="Color"
              onPress={() => setColorOpen(true)}
            />
            {hasGroups ? (
              <QuickAddPill
                icon={<Folder size={13} color="$mutedForeground" />}
                label={activeGroupName ?? "Group"}
                onPress={() => setGroupOpen(true)}
              />
            ) : null}
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              onPress={() => setNoteOpen((v) => !v)}
            />
          </>
        }
      />

      <MediaPickerSheet
        open={iconOpen}
        onClose={() => {
          setIconOpen(false);
          refocus();
        }}
        tabs={["emoji", "icon"]}
        value={parseMediaIcon(icon)}
        onChange={handlePickIcon}
      />
      <FrequencyPickerSheet
        open={freqOpen}
        onOpenChange={(o) => {
          setFreqOpen(o);
          if (!o) refocus();
        }}
        frequency={frequency}
        setFrequency={setFrequency}
        scheduledDays={scheduledDays}
        setScheduledDays={setScheduledDays}
        weeklyTarget={weeklyTarget}
        setWeeklyTarget={setWeeklyTarget}
      />
      <TargetPickerSheet
        open={targetOpen}
        onOpenChange={(o) => {
          setTargetOpen(o);
          if (!o) refocus();
        }}
        frequency={frequency}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        unit={unit}
        setUnit={setUnit}
      />
      <ColorPickerSheet
        open={colorOpen}
        onOpenChange={(o) => {
          setColorOpen(o);
          if (!o) refocus();
        }}
        color={color}
        setColor={setColor}
      />
      <PillPickerSheet
        open={groupOpen}
        onOpenChange={(o) => {
          setGroupOpen(o);
          if (!o) refocus();
        }}
        title="Group"
        options={groupOptions}
        value={groupId ?? NO_GROUP_VALUE}
        onSelect={(v) => setGroupId(v === NO_GROUP_VALUE ? null : v)}
      />
    </>
  );
}
