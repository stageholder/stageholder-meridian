// packages/features/src/habits/habit-detail-sheet.native.tsx  (NATIVE)
//
// The habit EDIT sheet, in the same language as the todo detail sheet and the
// habit quick-add: every field commits on its own, nothing to save or cancel.
// Replaced the "Edit Habit" form sheet (the full HabitForm with labelled
// fields and a Cancel/Save pair, 2026-10-21) so create and edit read as one
// component family:
//
//   [icon] Name (bare, large)                              [⋯]
//   (Every day) (1× unit) (● Color) (Group)   ← the quick-add pills, live
//   Notes…                                    ← ghost textarea
//   Created 3 Jun 2026                        ← muted meta
//
// Archive / delete live behind "⋯" (host action sheet). Pickers are the SAME
// sibling sheets the quick-add uses (habit-pickers.native.tsx), mounted once
// the slide has settled; each pick commits immediately through `onPatch`.
// Fit-sized, drag-to-close from the grabber strip, keyboard-first on drag —
// the todo detail sheet's rules, see todo-detail-sheet.native.tsx.
import { useEffect, useRef, useState } from "react";
import { Keyboard, TextInput } from "react-native";
import { format } from "date-fns";
import { Folder } from "@tamagui/lucide-icons-2/icons/Folder";
import { MoreHorizontal } from "@tamagui/lucide-icons-2/icons/MoreHorizontal";
import { Repeat } from "@tamagui/lucide-icons-2/icons/Repeat";
import { Smile } from "@tamagui/lucide-icons-2/icons/Smile";
import { Target } from "@tamagui/lucide-icons-2/icons/Target";
import {
  FormSheet,
  IconButton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { MediaValue } from "@stageholder/ui/pickers";
import { MediaGlyph, MediaPickerSheet } from "@stageholder/ui/pickers";
import { useTheme } from "tamagui";
import type { Habit } from "@repo/core/types";
import {
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
import type { HabitFormValues } from "./habit-form";
import { encodeMediaIcon, parseMediaIcon } from "./icon-value";
import type { HabitDetailSheetProps } from "./habit-detail-sheet.types";

const TITLE_FONT = 20;
const TITLE_LINE = 26;

function fmtStamp(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM yyyy");
}

/** Picker sheets slide up from the screen bottom — under an open keyboard
 *  they'd be hidden behind the keys (2026-10-21). Drop the keyboard first. */
function openPicker(set: (open: boolean) => void) {
  Keyboard.dismiss();
  set(true);
}

export function HabitDetailSheet({
  open,
  onOpenChange,
  habit,
  groups,
  onPatch,
  onMore,
}: HabitDetailSheetProps) {
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const muted = theme.mutedForeground?.val ?? "#888";

  const nameRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Text drafts, committed on blur/return or by the debounce below. Pills read
  // straight off `habit` (the host's optimistic cache flips it instantly).
  const [name, setName] = useState(habit?.name ?? "");
  const [notes, setNotes] = useState(habit?.description ?? "");
  const seededFor = useRef<string | null>(habit?.id ?? null);
  useEffect(() => {
    if (!habit) return;
    if (seededFor.current !== habit.id || !open) {
      setName(habit.name);
      setNotes(habit.description ?? "");
      seededFor.current = habit.id;
    }
  }, [habit, open]);

  const [pickersReady, setPickersReady] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const [iconOpen, setIconOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Keyboard WITH the slide; the settle focus below is only a backstop.
      nameRef.current?.focus();
    }
    if (!open && wasOpen.current) {
      nameRef.current?.blur();
      notesRef.current?.blur();
      Keyboard.dismiss();
    }
    wasOpen.current = open;
  }, [open]);

  // Debounced autosave for the drafts (blur is not a reliable commit point on
  // native — a pill tap does not blur a TextInput).
  const nameDraft = name.trim();
  const notesDraft = notes.trim();
  const habitName = habit?.name;
  const habitNotes = habit?.description ?? "";
  useEffect(() => {
    if (!habit || !open) return;
    if (!nameDraft || nameDraft === habitName) return;
    const t = setTimeout(() => onPatch({ name: nameDraft }), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameDraft, habitName, open]);
  useEffect(() => {
    if (!habit || !open) return;
    if (notesDraft === habitNotes) return;
    const t = setTimeout(() => onPatch({ description: notesDraft }), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft, habitNotes, open]);

  if (!habit) return null;

  function commitName() {
    if (!habit) return;
    const next = name.trim();
    if (!next) {
      setName(habit.name); // never save an empty name — restore
      return;
    }
    if (next !== habit.name) onPatch({ name: next });
  }
  function commitNotes() {
    if (!habit) return;
    const next = notes.trim();
    if (next !== (habit.description ?? "")) onPatch({ description: next });
  }

  // Pill state is the habit itself; the picker sheets take setters, so each
  // setter here is a commit.
  const frequency = habit.frequency as HabitFormValues["frequency"];
  const scheduledDays = habit.scheduledDays ?? [];
  const weeklyTarget = habit.weeklyTarget ?? 2;
  const unit = habit.unit ?? "";
  const color = habit.color ?? "#3b82f6";
  const hasGroups = !!groups && groups.length > 0;
  const activeGroupName = groups?.find((g) => g.id === habit.groupId)?.name;
  const groupOptions: PillPickerOption[] = [
    { value: NO_GROUP_VALUE, label: "Ungrouped" },
    ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ];

  const freqLabel =
    frequency === "daily"
      ? "Every day"
      : frequency === "weekly"
        ? "Specific days"
        : "Times / week";
  const targetLabel = `${habit.targetCount}×${unit.trim() ? ` ${unit.trim()}` : ""}`;
  const created = fmtStamp(habit.createdAt);

  const handlePickIcon = (value: MediaValue | null) => {
    onPatch({ icon: encodeMediaIcon(value) ?? "" });
    setIconOpen(false);
  };

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            nameRef.current?.blur();
            notesRef.current?.blur();
            Keyboard.dismiss();
          }
          onOpenChange(next);
        }}
        hideFooter
        mountChildren="open"
        disableDrag={false}
        hideHandle
        onSettled={() => {
          if (!openRef.current) return; // the kit settles on CLOSE too
          setPickersReady(true);
          setTimeout(() => {
            const el = nameRef.current;
            if (!el) return;
            // Opened from a closing menu/sheet the field can end up FOCUSED
            // with the keyboard down (caret, no keys) — a plain focus() is a
            // no-op then, so always cycle it (a 30 ms blur is invisible).
            el.blur();
            setTimeout(() => el.focus(), 30);
          }, 80);
        }}
        frameProps={{ pt: "$2", pb: "$4" }}
      >
        <YStack gap="$2.5">
          {/* Drag zone — see todo-detail-sheet.native.tsx. */}
          <View
            aria-label="Drag to close"
            height={22}
            mt={-4}
            items="center"
            justify="center"
            onTouchStart={() => {
              if (!Keyboard.isVisible()) return;
              nameRef.current?.blur();
              notesRef.current?.blur();
              Keyboard.dismiss();
            }}
          >
            <View
              width={36}
              height={4}
              rounded={9999}
              bg="$mutedForeground"
              opacity={0.35}
            />
          </View>

          {/* Icon + bare name + more. */}
          <XStack items="flex-start" gap="$3">
            <View
              role="button"
              aria-label="Pick an icon"
              onPress={() => openPicker(setIconOpen)}
              width={36}
              height={36}
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
              items="center"
              justify="center"
              pressStyle={{ opacity: 0.7 }}
            >
              <MediaGlyph
                value={parseMediaIcon(habit.icon ?? "")}
                size={20}
                fallback={<Smile size={18} color="$mutedForeground" />}
              />
            </View>
            <View flex={1} minW={0}>
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={(t) => setName(t.replace(/\n+/g, " "))}
                onBlur={commitName}
                onSubmitEditing={commitName}
                multiline
                submitBehavior="blurAndSubmit"
                placeholder="Habit name"
                placeholderTextColor={muted}
                scrollEnabled={false}
                style={{
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  fontSize: TITLE_FONT,
                  lineHeight: TITLE_LINE,
                  fontWeight: "600",
                  color: fg,
                  marginTop: (36 - TITLE_LINE) / 2,
                }}
              />
            </View>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="More actions"
              onPress={onMore}
            >
              <MoreHorizontal size={18} />
            </IconButton>
          </XStack>

          {/* The quick-add pills, now live. */}
          <FormSheet.HorizontalScroll keyboardShouldPersistTaps="always">
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
                label={activeGroupName ?? "Ungrouped"}
                onPress={() => openPicker(setGroupOpen)}
              />
            ) : null}
          </FormSheet.HorizontalScroll>

          <TextInput
            ref={notesRef}
            value={notes}
            onChangeText={setNotes}
            onBlur={commitNotes}
            multiline
            placeholder="Add notes…"
            placeholderTextColor={muted}
            scrollEnabled={false}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 0,
              fontSize: 15,
              lineHeight: 21,
              color: fg,
              minHeight: 29,
              textAlignVertical: "top",
            }}
          />

          {created ? (
            <Text fontSize="$1" color="$mutedForeground" pt="$1">
              {`Created ${created}`}
            </Text>
          ) : null}
        </YStack>

        {/* Pickers NESTED in the sheet (not siblings): Tamagui gives a sheet
            rendered inside another sheet `parentSheet.zIndex + 1`, so they
            stack above this frame by contract. As siblings they relied on
            portal insertion order and, hosted on the Habits tab, rendered
            BEHIND this frame (overlay above, frame hidden; 2026-10-21). */}
        {pickersReady || freqOpen ? (
          <FrequencyPickerSheet
            open={freqOpen}
            onOpenChange={setFreqOpen}
            frequency={frequency}
            setFrequency={(f) =>
              onPatch({
                frequency: f,
                // Leaving "specific days" clears the schedule server-side.
                ...(f !== "weekly" ? { scheduledDays: null } : {}),
              })
            }
            scheduledDays={scheduledDays}
            setScheduledDays={(d) => onPatch({ scheduledDays: d })}
            weeklyTarget={weeklyTarget}
            setWeeklyTarget={(n) => onPatch({ weeklyTarget: n })}
          />
        ) : null}
        {pickersReady || targetOpen ? (
          <TargetPickerSheet
            open={targetOpen}
            onOpenChange={setTargetOpen}
            frequency={frequency}
            targetCount={habit.targetCount}
            setTargetCount={(n) => onPatch({ targetCount: n })}
            unit={unit}
            setUnit={(u) => onPatch({ unit: u })}
          />
        ) : null}
        {pickersReady || colorOpen ? (
          <ColorPickerSheet
            open={colorOpen}
            onOpenChange={setColorOpen}
            color={color}
            setColor={(c) => onPatch({ color: c })}
          />
        ) : null}
        {pickersReady || groupOpen ? (
          <PillPickerSheet
            open={groupOpen}
            onOpenChange={setGroupOpen}
            title="Group"
            options={groupOptions}
            value={habit.groupId ?? NO_GROUP_VALUE}
            onSelect={(v) =>
              onPatch({ groupId: v === NO_GROUP_VALUE ? null : v })
            }
          />
        ) : null}
      </FormSheet>
      {/* The icon picker stays a SIBLING: it is a 560 px constant-snap sheet,
          and nesting it inside this fit-sized frame kept the frame from ever
          appearing (2026-10-21). Mount order puts it above us. */}
      {pickersReady || iconOpen ? (
        <MediaPickerSheet
          open={iconOpen}
          onClose={() => setIconOpen(false)}
          tabs={["emoji", "icon"]}
          value={parseMediaIcon(habit.icon ?? "")}
          onChange={handlePickIcon}
        />
      ) : null}
    </>
  );
}
