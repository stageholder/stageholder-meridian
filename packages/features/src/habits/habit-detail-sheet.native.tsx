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
import { FormSheet, Text, View, XStack, YStack } from "@stageholder/ui";
import type { MediaValue } from "@stageholder/ui/pickers";
import { MediaGlyph } from "@stageholder/ui/pickers";
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
  frequencyLabel,
  NO_GROUP_VALUE,
  TargetPickerSheet,
} from "./habit-pickers.native";
import type { HabitFormValues } from "./habit-form";
import { ComposerSheet } from "../_internal/composer-sheet.native";
import { MoreActionsSheet } from "../_internal/more-actions-sheet.native";
import { IconPickerSheet } from "../_internal/icon-picker-sheet.native";
import { openAfterKeyboard } from "../_internal/open-after-keyboard.native";
import { encodeMediaIcon, habitTint, parseMediaIcon } from "./icon-value";
import type { HabitDetailSheetProps } from "./habit-detail-sheet.types";

const TITLE_FONT = 20;
const TITLE_LINE = 26;

function fmtStamp(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM yyyy");
}

/** Open a nested picker/menu sheet. The keyboard (if up) STAYS up: the
 *  nested sheet carries its own keyboard spacer and opens above it. Dismissing
 *  the keyboard here collapsed the parent sheet mid-open and the nested frame
 *  never placed (2026-10-25). */
function openPicker(set: (open: boolean) => void) {
  set(true);
}

/**
 * Stable shell + per-open body — see todo-detail-sheet.native.tsx.
 */
export function HabitDetailSheet(props: HabitDetailSheetProps) {
  return (
    <ComposerSheet open={props.open} onOpenChange={props.onOpenChange}>
      {props.habit ? <HabitDetail key={props.habit.id} {...props} /> : null}
    </ComposerSheet>
  );
}

function HabitDetail({
  open,
  onOpenChange,
  habit,
  groups,
  onPatch,
  moreActions,
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

  const [iconOpen, setIconOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  // No autofocus: a DETAIL sheet is for reading and tapping pills; raising
  // the keyboard on every open lifted the frame mid-slide and made the first
  // tap on "⋯"/pills land on a frame still moving (2026-10-25). Tap the
  // title or notes to edit.

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

  const freqLabel = frequencyLabel(frequency, scheduledDays, weeklyTarget);
  const targetLabel = `${habit.targetCount}×${unit.trim() ? ` ${unit.trim()}` : ""}`;
  const created = fmtStamp(habit.createdAt);

  const handlePickIcon = (value: MediaValue | null) => {
    onPatch({ icon: encodeMediaIcon(value) ?? "" });
    setIconOpen(false);
  };

  // Close from the handle: commit the drafts and drop the keyboard before
  // the close slide. Other close paths unmount this body — the cleanup below
  // commits whatever is still uncommitted (see todo-detail-sheet.native.tsx).
  function closeSheet() {
    commitName();
    commitNotes();
    Keyboard.dismiss();
    onOpenChange(false);
  }
  const latest = useRef({ name, notes, habit, onPatch });
  latest.current = { name, notes, habit, onPatch };
  useEffect(
    () => () => {
      const { name: n, notes: d, habit: cur, onPatch: patch } = latest.current;
      if (!cur) return;
      const nextName = n.trim();
      if (nextName && nextName !== cur.name) patch({ name: nextName });
      const nextNotes = d.trim();
      if (nextNotes !== (cur.description ?? ""))
        patch({ description: nextNotes });
    },
    [],
  );

  return (
    <>
      <YStack gap="$2.5">
        {/* Close handle — see todo-detail-sheet.native.tsx. */}
        <View
          role="button"
          aria-label="Close"
          height={22}
          mt={-4}
          items="center"
          justify="center"
          hitSlop={8}
          onPress={closeSheet}
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
            onPress={() => openAfterKeyboard(setIconOpen)}
            width={36}
            height={36}
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            items="center"
            justify="center"
            pressStyle={{ opacity: 0.7 }}
            style={{ backgroundColor: habitTint(habit.color) }}
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
          {/* Tamagui-pressable View, not the kit IconButton: the kit's RN
                Pressable intermittently gets no touch inside this portaled
                sheet (same class as the composer's send button). */}
          <View
            role="button"
            aria-label="More actions"
            width={32}
            height={32}
            rounded={9999}
            items="center"
            justify="center"
            hitSlop={6}
            pressStyle={{ bg: "$secondary", opacity: 0.8 }}
            onPress={() => openPicker(setMoreOpen)}
          >
            <MoreHorizontal size={18} color="$color" />
          </View>
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
      {
        <MoreActionsSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          title={habit.name}
          actions={moreActions}
        />
      }
      {
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
      }
      {
        <TargetPickerSheet
          open={targetOpen}
          onOpenChange={setTargetOpen}
          frequency={frequency}
          targetCount={habit.targetCount}
          setTargetCount={(n) => onPatch({ targetCount: n })}
          unit={unit}
          setUnit={(u) => onPatch({ unit: u })}
        />
      }
      {
        <ColorPickerSheet
          open={colorOpen}
          onOpenChange={setColorOpen}
          color={color}
          setColor={(c) => onPatch({ color: c })}
        />
      }
      {
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
      }
      {/* The icon picker stays a SIBLING: it is a 560 px constant-snap sheet,
          and nesting it inside this fit-sized frame kept the frame from ever
          appearing (2026-10-21). Mount order puts it above us. */}
      {
        <IconPickerSheet
          open={iconOpen}
          onOpenChange={setIconOpen}
          tabs={["emoji", "icon"]}
          value={parseMediaIcon(habit.icon ?? "")}
          onChange={handlePickIcon}
        />
      }
    </>
  );
}
