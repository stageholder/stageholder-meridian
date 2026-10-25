// packages/features/src/todos/todo-detail-sheet.native.tsx  (NATIVE)
//
// The todo DETAIL sheet — what a tap on a todo row opens on native. It
// replaced the "Edit Todo" form sheet (labelled fields, a Cancel/Save pair in
// the middle of the body, the subtasks block BELOW Save and a full-width red
// Delete button under that; 2026-10-20). That read as a form you had to
// submit, with half the sheet outside the form's lifecycle.
//
// This is a Todoist/Things-style detail instead: every field commits on its
// own the moment it changes (title/notes on blur or return, pills on pick,
// the status circle on tap), so there is nothing to save or cancel — closing
// the sheet is always safe. The layout mirrors the quick-add sheet so create
// and edit read as one component family:
//
//   [◯] Title (bare, large)                                   [⋯]
//   (Priority) (List) (Do date) (Deadline)      ← same pills as quick-add
//   Notes…                                      ← ghost textarea
//   ───────────────────────────────────────────
//   Subtasks (host slot — instant commit)
//   Created 20 Oct · Completed 21 Oct           ← muted meta
//
// Destructive actions live behind "⋯" (an in-app menu sheet), never as a big
// red button in the body. Pickers and the menu are sheets NESTED in this one,
// always mounted: a closed kit Sheet renders nothing (lazy root), and a sheet
// first mounted in the same commit it opens stayed closed (2026-10-25).
import { useEffect, useRef, useState } from "react";

import { Keyboard, ScrollView, TextInput } from "react-native";
import { format } from "date-fns";
import { CalendarDays } from "@tamagui/lucide-icons-2/icons/CalendarDays";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Flag } from "@tamagui/lucide-icons-2/icons/Flag";
import { Inbox } from "@tamagui/lucide-icons-2/icons/Inbox";
import { MoreHorizontal } from "@tamagui/lucide-icons-2/icons/MoreHorizontal";
import {
  FormSheet,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useTheme } from "tamagui";
import type { Todo } from "@repo/core/types";
import {
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
import { ComposerSheet } from "../_internal/composer-sheet.native";
import { DatePill, DatePickerSheet } from "../_internal/date-pill.native";
import { openAfterKeyboard } from "../_internal/open-after-keyboard.native";
import { MoreActionsSheet } from "../_internal/more-actions-sheet.native";
import type { TodoDetailSheetProps } from "./todo-detail-sheet.types";

/** Priority dot colors — fixed brand swatches (from todo-form.tsx). */
const PRIORITY_DOT: Record<string, string> = {
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};
const PRIORITY_KEYS = ["none", "low", "medium", "high", "urgent"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** See quick-add: `tint`, not `color`, so the kit Pill's icon clone can't
 *  clobber it with a theme token. */
function Dot({ tint }: { tint: string }) {
  return (
    <View
      width={10}
      height={10}
      rounded={9999}
      style={{ backgroundColor: tint }}
    />
  );
}

function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}
function fmtDate(iso: string): string {
  return format(parseLocalDay(iso), "d MMM yyyy");
}
function fmtStamp(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM yyyy");
}

const SUBTASKS_MAX_HEIGHT = 280;
const TITLE_FONT = 20;
const TITLE_LINE = 26;

/**
 * Stable shell + per-open body. `TodoDetail` (the drafts, the pickers, the
 * menu) is a CHILD of the sheet: the kit's `open` policy unmounts it at close
 * and mounts it fresh at open, so initial state is the reset — a tap on
 * another todo can never show (or autosave) the previous one's title. Keyed
 * on the todo id as well, for a different todo tapped before the close
 * unmount has run.
 */
export function TodoDetailSheet(props: TodoDetailSheetProps) {
  return (
    <ComposerSheet open={props.open} onOpenChange={props.onOpenChange}>
      {props.todo ? <TodoDetail key={props.todo.id} {...props} /> : null}
    </ComposerSheet>
  );
}

function TodoDetail({
  open,
  onOpenChange,
  todo,
  lists,
  accentColor,
  onPatch,
  onToggleStatus,
  moreActions,
  subtasks,
}: TodoDetailSheetProps) {
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const muted = theme.mutedForeground?.val ?? "#888";
  const border = theme.borderColor?.val ?? "#ccc";

  const titleRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Text fields are DRAFTS (seeded once — this instance lives for one open);
  // everything else is read straight off `todo` (the host's optimistic cache
  // flips it instantly).
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.description ?? "");

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [doOpen, setDoOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  // No autofocus: a DETAIL sheet is for reading and tapping pills; raising
  // the keyboard on every open lifted the frame mid-slide and made the first
  // tap on "⋯"/pills land on a frame still moving (2026-10-25). Tap the
  // title or notes to edit.

  // Debounced autosave for the two text drafts. Blur is not a reliable
  // commit point on native: tapping a pill, the status circle or plain text
  // does NOT blur a TextInput, so a note typed right before such a tap would
  // sit uncommitted until the sheet closed. Save while typing instead (same
  // idea as the journal autosave), with blur/return as the immediate path.
  const titleDraft = title.trim();
  const notesDraft = notes.trim();
  const todoTitle = todo?.title;
  const todoNotes = todo?.description ?? "";
  useEffect(() => {
    if (!todo || !open) return;
    if (!titleDraft || titleDraft === todoTitle) return;
    const t = setTimeout(() => onPatch({ title: titleDraft }), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleDraft, todoTitle, open]);
  useEffect(() => {
    if (!todo || !open) return;
    if (notesDraft === todoNotes) return;
    const t = setTimeout(
      () => onPatch({ description: notesDraft || null }),
      700,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft, todoNotes, open]);

  if (!todo) return null;

  const done = todo.status === "done";
  const showListPill = !!lists && lists.length > 1;
  const selectedList = lists?.find((l) => l.id === todo.listId);

  function commitTitle() {
    if (!todo) return;
    const next = title.trim();
    if (!next) {
      setTitle(todo.title); // never save an empty title — restore
      return;
    }
    if (next !== todo.title) onPatch({ title: next });
  }
  function commitNotes() {
    if (!todo) return;
    const next = notes.trim();
    if (next !== (todo.description ?? ""))
      onPatch({ description: next || null });
  }

  const priorityOptions: PillPickerOption[] = PRIORITY_KEYS.map((k) => ({
    value: k,
    label: k === "none" ? "None" : cap(k),
    icon: k === "none" ? undefined : <Dot tint={PRIORITY_DOT[k]} />,
  }));
  const listOptions: PillPickerOption[] = (lists ?? []).map((l) => ({
    value: l.id,
    label: l.name,
    icon: l.isDefault ? (
      <Inbox size={14} color="$primary" />
    ) : (
      <Dot tint={l.color || "#6b7280"} />
    ),
  }));

  const created = fmtStamp(todo.createdAt);
  const completed = done ? fmtStamp(todo.completedAt) : null;

  // Close from the handle: commit the drafts (unmounting a field fires no
  // blur) and drop the keyboard before the close slide. Other close paths
  // (overlay tap, Android back, the host) unmount this body — the cleanup
  // below commits whatever is still uncommitted.
  function closeSheet() {
    commitTitle();
    commitNotes();
    Keyboard.dismiss();
    onOpenChange(false);
  }
  const latest = useRef({ title, notes, todo, onPatch });
  latest.current = { title, notes, todo, onPatch };
  useEffect(
    () => () => {
      const { title: t, notes: n, todo: cur, onPatch: patch } = latest.current;
      if (!cur) return;
      const nextTitle = t.trim();
      if (nextTitle && nextTitle !== cur.title) patch({ title: nextTitle });
      const nextNotes = n.trim();
      if (nextNotes !== (cur.description ?? ""))
        patch({ description: nextNotes || null });
    },
    [],
  );

  return (
    <>
      {/* Shell = app-owned ComposerSheet (see TodoDetailSheet above): keyboard
          spacer from frame one and NO self-dismiss. The kit FormSheet's
          spacer collapse on a fit sheet raced Tamagui's re-measure and
          sometimes closed the sheet (2026-10-25). Close = overlay tap or the
          handle below. */}
      <YStack gap="$2.5">
        {/* CLOSE HANDLE: a tap commits the drafts and closes (the shell has
              no drag; tapping the dimmed page above closes too). */}
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
        {/* Status circle + bare title + more. The circle mirrors the row's
              checkbox (accent fill when done) so the sheet reads as the row,
              expanded. */}
        <XStack items="flex-start" gap="$3">
          <View
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "Mark as not done" : "Mark as done"}
            hitSlop={8}
            mt={(TITLE_LINE - 24) / 2}
            width={24}
            height={24}
            rounded={9999}
            items="center"
            justify="center"
            borderWidth={2}
            style={{
              borderColor: done ? accentColor : border,
              backgroundColor: done ? accentColor : "transparent",
            }}
            pressStyle={{ scale: 0.9, opacity: 0.85 }}
            transition="quick"
            onPress={onToggleStatus}
          >
            {done ? <Check size={14} color="#ffffff" /> : null}
          </View>
          <View flex={1} minW={0}>
            <TextInput
              ref={titleRef}
              value={title}
              onChangeText={(t) => setTitle(t.replace(/\n+/g, " "))}
              onBlur={commitTitle}
              onSubmitEditing={commitTitle}
              multiline
              submitBehavior="blurAndSubmit"
              placeholder="Untitled"
              placeholderTextColor={muted}
              scrollEnabled={false}
              style={{
                paddingVertical: 0,
                paddingHorizontal: 0,
                fontSize: TITLE_FONT,
                lineHeight: TITLE_LINE,
                fontWeight: "600",
                color: done ? muted : fg,
                textDecorationLine: done ? "line-through" : "none",
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
            onPress={() => openAfterKeyboard(setMoreOpen)}
          >
            <MoreHorizontal size={18} color="$color" />
          </View>
        </XStack>

        {/* Attribute pills — the quick-add row, now live: each pick commits. */}
        <FormSheet.HorizontalScroll keyboardShouldPersistTaps="always">
          <QuickAddPill
            icon={
              todo.priority !== "none" ? (
                <Dot tint={PRIORITY_DOT[todo.priority]} />
              ) : undefined
            }
            label={todo.priority === "none" ? "Priority" : cap(todo.priority)}
            onPress={() => openAfterKeyboard(setPriorityOpen)}
          />
          {showListPill ? (
            <QuickAddPill
              icon={
                selectedList?.isDefault ? (
                  <Inbox size={13} color="$primary" />
                ) : selectedList ? (
                  <Dot tint={selectedList.color || "#6b7280"} />
                ) : undefined
              }
              label={selectedList?.name ?? "List"}
              onPress={() => openAfterKeyboard(setListOpen)}
            />
          ) : null}
          {/* Dates = the app's DatePill + nested DatePickerSheet (below),
                same pattern as the quick-add. The pill drops the keyboard
                before its sheet opens. */}
          <DatePill
            placeholder="Do"
            value={todo.doDate ? parseLocalDay(todo.doDate.slice(0, 10)) : null}
            onPress={() => openAfterKeyboard(setDoOpen)}
          />
          <DatePill
            placeholder="Deadline"
            value={
              todo.dueDate ? parseLocalDay(todo.dueDate.slice(0, 10)) : null
            }
            onPress={() => openAfterKeyboard(setDueOpen)}
          />
        </FormSheet.HorizontalScroll>

        {/* Notes — ghost field, commits on blur. */}
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

        {subtasks ? (
          <>
            <Separator />
            {/* Capped so a long subtask list scrolls here instead of pushing
                  the fit-sized frame past the top of the screen. Plain RN
                  ScrollView (not Sheet.ScrollView): it must not bridge its
                  drag into the sheet. */}
            <ScrollView
              style={{ maxHeight: SUBTASKS_MAX_HEIGHT }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {subtasks}
            </ScrollView>
          </>
        ) : null}

        {created || completed ? (
          <Text fontSize="$1" color="$mutedForeground" pt="$1">
            {[
              created ? `Created ${created}` : null,
              completed ? `Completed ${completed}` : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
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
          title={todo.title}
          actions={moreActions}
        />
      }
      {
        <PillPickerSheet
          open={priorityOpen}
          onOpenChange={setPriorityOpen}
          title="Priority"
          options={priorityOptions}
          value={todo.priority}
          onSelect={(v) => onPatch({ priority: v as Todo["priority"] })}
        />
      }
      {
        <PillPickerSheet
          open={listOpen}
          onOpenChange={setListOpen}
          title="List"
          options={listOptions}
          value={todo.listId}
          onSelect={(v) => onPatch({ listId: v })}
        />
      }
      {
        <DatePickerSheet
          open={doOpen}
          onOpenChange={setDoOpen}
          title="Do date"
          value={todo.doDate ? parseLocalDay(todo.doDate.slice(0, 10)) : null}
          onChange={(d) =>
            onPatch({ doDate: d ? format(d, "yyyy-MM-dd") : null })
          }
        />
      }
      {
        <DatePickerSheet
          open={dueOpen}
          onOpenChange={setDueOpen}
          title="Deadline"
          value={todo.dueDate ? parseLocalDay(todo.dueDate.slice(0, 10)) : null}
          onChange={(d) =>
            onPatch({ dueDate: d ? format(d, "yyyy-MM-dd") : null })
          }
        />
      }
    </>
  );
}
