// packages/features/src/habits/quick-add-habit-sheet.native.tsx  (NATIVE)
//
// Compact quick-add for creating a habit on native: icon + name, a pill row
// (frequency / target / color / group / note) and an accent send button.
// Create-only; editing is the habit detail sheet.
//
// Same ONE RULE as the todo quick-add: every open is a FRESH instance (a child of
// the sheet, which unmounts it at close) — initial
// state is the reset, `autoFocus` raises the keyboard with the slide, and the
// keyboard drops because the field is gone. No effects, no refs for focus.
import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
import { Folder } from "@tamagui/lucide-icons-2/icons/Folder";
import { Repeat } from "@tamagui/lucide-icons-2/icons/Repeat";
import { Smile } from "@tamagui/lucide-icons-2/icons/Smile";
import { StickyNote } from "@tamagui/lucide-icons-2/icons/StickyNote";
import { Target } from "@tamagui/lucide-icons-2/icons/Target";
import { Input, View, XStack } from "@stageholder/ui";
import { useTheme } from "tamagui";
import type { MediaValue } from "@stageholder/ui/pickers";
import { MediaGlyph } from "@stageholder/ui/pickers";
import {
  QuickAddBody,
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
import { ComposerSheet } from "../_internal/composer-sheet.native";
import {
  ColorPickerSheet,
  FrequencyPickerSheet,
  frequencyLabel,
  NO_GROUP_VALUE,
  TargetPickerSheet,
} from "./habit-pickers.native";
import { IconPickerSheet } from "../_internal/icon-picker-sheet.native";
import { openAfterKeyboard } from "../_internal/open-after-keyboard.native";
import { encodeMediaIcon, habitTint, parseMediaIcon } from "./icon-value";
import { HABIT_FORM_DEFAULTS, type HabitFormValues } from "./habit-form";
import type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.types";

/** Open a nested picker/menu sheet. The keyboard (if up) STAYS up: the
 *  nested sheet carries its own keyboard spacer and opens above it. Dismissing
 *  the keyboard here collapsed the parent sheet mid-open and the nested frame
 *  never placed (2026-10-25). */
function openPicker(set: (open: boolean) => void) {
  set(true);
}

export function QuickAddHabitSheet(props: QuickAddHabitSheetProps) {
  // Stable shell; the state component below is a CHILD of the sheet, so the
  // kit's `open` policy unmounts it at close and mounts it fresh at open —
  // initial state is the reset.
  return (
    <ComposerSheet open={props.open} onOpenChange={props.onOpenChange}>
      <HabitQuickAdd {...props} />
    </ComposerSheet>
  );
}

function HabitQuickAdd({
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
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const placeholderColor =
    theme.placeholderColor?.val ?? theme.mutedForeground?.val ?? "#888";

  // The name is UNCONTROLLED (text in a ref, only an empty/non-empty boolean
  // in state): a controlled field re-rendered the whole pill row per
  // keystroke and dropped characters on slow Android devices.
  const nameText = useRef("");
  const [hasName, setHasName] = useState(false);
  const handleNameChange = (t: string) => {
    nameText.current = t;
    const next = t.trim().length > 0;
    setHasName((prev) => (prev === next ? prev : next));
  };
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

  // Keyboard with the slide: when the sheet opens, focus the field one
  // animation frame later (the kit mounts the field at open and attaches it
  // a beat after; the frame callback is cancelled on close/unmount).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Bring the keyboard back to the name after a picker closes.
  const refocus = () => nameRef.current?.focus();

  // One submit at a time (Android can echo `onSubmitEditing`; see the todo
  // quick-add). Released only when the host's `isSubmitting` falls again
  // (a failed create); a successful one closes the sheet.
  const submitLock = useRef(false);
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (isSubmitting) wasSubmitting.current = true;
    else if (wasSubmitting.current) {
      wasSubmitting.current = false;
      submitLock.current = false;
    }
  }, [isSubmitting]);
  function handleSubmit() {
    if (submitLock.current) return;
    const name = nameText.current.trim();
    if (!name) return;
    submitLock.current = true;
    void onSubmit({
      name,
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
      ...(hasGroups ? { groupId } : {}),
    });
  }

  const handlePickIcon = (value: MediaValue | null) => {
    setIcon(encodeMediaIcon(value) ?? "");
    setIconOpen(false);
    refocus();
  };

  const freqLabel = frequencyLabel(frequency, scheduledDays, weeklyTarget);
  const targetLabel = `${targetCount}×${unit.trim() ? ` ${unit.trim()}` : ""}`;
  const activeGroupName = groups?.find((g) => g.id === groupId)?.name;
  const groupOptions: PillPickerOption[] = [
    { value: NO_GROUP_VALUE, label: "Ungrouped" },
    ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ];

  return (
    <>
      <QuickAddBody
        title="New Habit"
        accentColor={accentColor}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
        submitDisabled={!hasName}
        field={
          <>
            <XStack gap="$2" items="center">
              <View
                role="button"
                aria-label="Pick an icon"
                onPress={() => openAfterKeyboard(setIconOpen)}
                width={40}
                height={40}
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                justify="center"
                // The picked color tints the tile at once (the same tint the
                // card will show), so "Color" visibly applies.
                style={{ backgroundColor: habitTint(color) }}
              >
                <MediaGlyph
                  value={parseMediaIcon(icon)}
                  size={22}
                  fallback={<Smile size={20} color="$mutedForeground" />}
                />
              </View>
              {/* GHOST field, like the todo composer's title: no border, no
                  box — same font metrics as smart-todo-input.native.tsx. */}
              <TextInput
                ref={nameRef}
                autoFocus
                defaultValue=""
                onChangeText={handleNameChange}
                placeholder="e.g. Read for 30 minutes"
                placeholderTextColor={placeholderColor}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={handleSubmit}
                autoCapitalize="sentences"
                style={{
                  flex: 1,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  lineHeight: 22,
                  color: fg,
                }}
              />
            </XStack>
            {noteOpen ? (
              <Input
                autoFocus
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
              onPress={() => openPicker(setFreqOpen)}
            />
            <QuickAddPill
              icon={<Target size={13} />}
              label={targetLabel}
              onPress={() => openPicker(setTargetOpen)}
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
              onPress={() => openPicker(setColorOpen)}
            />
            {hasGroups ? (
              <QuickAddPill
                icon={<Folder size={13} color="$mutedForeground" />}
                label={activeGroupName ?? "Group"}
                onPress={() => openPicker(setGroupOpen)}
              />
            ) : null}
            {/* Note: the field mounts with `autoFocus`; closing it hands the
                keyboard back to the name. */}
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              onPress={() => {
                if (noteOpen) refocus();
                setNoteOpen(!noteOpen);
              }}
            />
          </>
        }
      >
        {
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
        }
        {
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
        }
        {
          <ColorPickerSheet
            open={colorOpen}
            onOpenChange={(o) => {
              setColorOpen(o);
              if (!o) refocus();
            }}
            color={color}
            setColor={setColor}
          />
        }
        {
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
        }
      </QuickAddBody>

      {/* The 560 px media picker stays a SIBLING: nested inside a fit-sized
          sheet it stopped that sheet's frame from appearing. */}
      {
        <IconPickerSheet
          open={iconOpen}
          onOpenChange={(o) => {
            setIconOpen(o);
            if (!o) refocus();
          }}
          tabs={["emoji", "icon"]}
          value={parseMediaIcon(icon)}
          onChange={handlePickIcon}
        />
      }
    </>
  );
}
