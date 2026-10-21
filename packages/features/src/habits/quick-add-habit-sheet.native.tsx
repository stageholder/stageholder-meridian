// packages/features/src/habits/quick-add-habit-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a habit on native. Icon + name
// on top; everything else is a pill with a default, so a name alone can create.
// Recomposes the proven HabitForm controls (MediaPickerSheet, Select, Input,
// ToggleGroup, NumberInput, color swatches) into the QuickAddSheet shell — the
// heavier sub-config (weekly days, target+unit, color) lives in small nested
// picker sheets (habit-pickers.native.tsx, shared with the detail sheet).
import { useEffect, useRef, useState } from "react";
import { TextInput, Keyboard } from "react-native";
import { Folder } from "@tamagui/lucide-icons-2/icons/Folder";
import { Repeat } from "@tamagui/lucide-icons-2/icons/Repeat";
import { Smile } from "@tamagui/lucide-icons-2/icons/Smile";
import { StickyNote } from "@tamagui/lucide-icons-2/icons/StickyNote";
import { Target } from "@tamagui/lucide-icons-2/icons/Target";
import { Input, View, XStack } from "@stageholder/ui";
import { useTheme } from "tamagui";
import type { MediaValue } from "@stageholder/ui/pickers";
import { MediaGlyph, MediaPickerSheet } from "@stageholder/ui/pickers";
import {
  QuickAddSheet,
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
import {
  ColorPickerSheet,
  FrequencyPickerSheet,
  NO_GROUP_VALUE,
  TargetPickerSheet,
} from "./habit-pickers.native";
import { encodeMediaIcon, parseMediaIcon } from "./icon-value";
import { HABIT_FORM_DEFAULTS, type HabitFormValues } from "./habit-form";
import type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.types";

// ── main sheet ──────────────────────────────────────────────────────────────

/** Picker sheets slide up from the screen bottom — under an open keyboard
 *  they'd be hidden behind the keys (2026-10-21). Drop the keyboard first. */
function openPicker(set: (open: boolean) => void) {
  Keyboard.dismiss();
  set(true);
}

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
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const placeholderColor =
    theme.placeholderColor?.val ?? theme.mutedForeground?.val ?? "#888";

  // The name field is UNCONTROLLED on purpose. A controlled RN TextInput
  // pushes `value` back to the native view after every keystroke; when the
  // JS thread lags (this sheet re-rendered its whole pill row per character)
  // keystrokes/backspaces that arrive in between are dropped on Android —
  // visible as "JEVB E2E Hab 0278…" in the Maestro run and as lost characters
  // for a fast typist on a slow phone. Keep the text in a ref and only lift a
  // boolean (empty ↔ non-empty) into state so the submit button repaints on
  // that transition instead of on every character (kit Chat.Composer pattern).
  const nameText = useRef("");
  const [hasName, setHasName] = useState(false);
  // Nested pickers (icon / frequency / target / color / group) are SIBLING
  // sheets; mounting their five shells in the create sheet's open commit is
  // what made the first open sit on a dimmed screen for ~1.4 s. They mount once
  // the kit FormSheet reports the slide has SETTLED (`onSettled`, kit
  // 0.4.0-alpha.2) — nothing can tap a pill before then — and stay mounted
  // afterwards (latched, 'first-open' semantics).
  const [pickersReady, setPickersReady] = useState(false);
  const handleNameChange = (t: string) => {
    nameText.current = t;
    const next = t.trim().length > 0;
    setHasName((prev) => (prev === next ? prev : next));
  };
  const [description, setDescription] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const noteRef = useRef<TextInput>(null);
  // Note pill → the field mounts in this commit, so focus it on the next
  // tick; toggling it off hands the keyboard back to the name.
  useEffect(() => {
    const t = setTimeout(
      () => (noteOpen ? noteRef.current : nameRef.current)?.focus(),
      50,
    );
    return () => clearTimeout(t);
  }, [noteOpen]);
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
  // Starts FALSE, not `open`: hosts mount this sheet in the same commit as
  // their first open (`useMountOnOpen` — Today palette, habits/todos tabs), so
  // the first render already has `open === true`. Seeding the ref with `open`
  // skipped this effect on that first open — no reset, and NO autofocus (the
  // keyboard never came up until the second open; 2026-10-20).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      nameText.current = "";
      setHasName(false);
      nameRef.current?.clear();
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
      // Focus in the open commit so the keyboard rises WITH the slide (a
      // settle-time focus read as a visible lag between sheet and keyboard).
      nameRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open, defaultGroupId]);

  function handleSubmit() {
    const name = nameText.current.trim();
    if (!name) return;
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
        submitDisabled={!hasName}
        onSettled={() => {
          setPickersReady(true);
          // Backstop for the FIRST open: the host mounts this sheet in the
          // same commit the open effect runs, so that focus() finds no input
          // yet and the keyboard never rose (todo sheet already does this).
          // Guarded — the kit fires onSettled on the close settle too.
          if (open) nameRef.current?.focus();
        }}
        field={
          <>
            <XStack gap="$2" items="center">
              <View
                role="button"
                aria-label="Pick an icon"
                onPress={() => openPicker(setIconOpen)}
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
              {/* GHOST field, like the todo composer's title: no border, no
                  box — the input sits directly on the sheet (same font metrics
                  as smart-todo-input.native.tsx). The boxed kit Input read as
                  a form next to the todo quick-add (2026-10-21). */}
              <TextInput
                ref={nameRef}
                defaultValue=""
                onChangeText={handleNameChange}
                placeholder="e.g. Read for 30 minutes"
                placeholderTextColor={placeholderColor}
                // Return creates the habit (Todoist-style quick capture) —
                // the keyboard's own action key is the most reachable submit
                // while typing, wherever the sheet sits.
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
                ref={noteRef as never}
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
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              onPress={() => setNoteOpen((v) => !v)}
            />
          </>
        }
      >
        {pickersReady || freqOpen ? (
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
        ) : null}
        {pickersReady || targetOpen ? (
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
        ) : null}
        {pickersReady || colorOpen ? (
          <ColorPickerSheet
            open={colorOpen}
            onOpenChange={(o) => {
              setColorOpen(o);
              if (!o) refocus();
            }}
            color={color}
            setColor={setColor}
          />
        ) : null}
        {pickersReady || groupOpen ? (
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
        ) : null}
      </QuickAddSheet>

      {pickersReady || iconOpen ? (
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
      ) : null}
    </>
  );
}
