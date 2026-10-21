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
// Destructive actions live behind "⋯" (native action sheet), never as a big
// red button in the body. Pickers are SIBLING sheets mounted once the slide
// has settled (kit `onSettled`), the same open choreography as quick-add.
import { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, TextInput, View as RNView } from "react-native";
import { format } from "date-fns";
import { CalendarDays } from "@tamagui/lucide-icons-2/icons/CalendarDays";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Flag } from "@tamagui/lucide-icons-2/icons/Flag";
import { Inbox } from "@tamagui/lucide-icons-2/icons/Inbox";
import { MoreHorizontal } from "@tamagui/lucide-icons-2/icons/MoreHorizontal";
import {
  FormSheet,
  IconButton,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { QuickDatePicker } from "@stageholder/ui/pickers";
import { useTheme } from "tamagui";
import type { Todo } from "@repo/core/types";
import {
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
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

/** Picker sheets slide up from the screen bottom — under an open keyboard
 *  they'd be hidden behind the keys (2026-10-21). Drop the keyboard first. */
function openPicker(set: (open: boolean) => void) {
  Keyboard.dismiss();
  set(true);
}

export function TodoDetailSheet({
  open,
  onOpenChange,
  todo,
  lists,
  accentColor,
  onPatch,
  onToggleStatus,
  onMore,
  subtasks,
}: TodoDetailSheetProps) {
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const muted = theme.mutedForeground?.val ?? "#888";
  const border = theme.borderColor?.val ?? "#ccc";

  const titleRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Text fields are DRAFTS committed on blur/return; everything else is read
  // straight off `todo` (the host's optimistic cache flips it instantly).
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.description ?? "");
  const seededFor = useRef<string | null>(todo?.id ?? null);
  useEffect(() => {
    // Re-seed when a DIFFERENT todo is shown, or the same one is reopened
    // (so an abandoned draft never survives a close). While open, the server
    // echo of our own commit must not clobber what the user is typing.
    if (!todo) return;
    if (seededFor.current !== todo.id || !open) {
      setTitle(todo.title);
      setNotes(todo.description ?? "");
      seededFor.current = todo.id;
    }
  }, [todo, open]);

  const [heavyReady, setHeavyReady] = useState(false);
  // Mirror of `open` for the settle callback below (its closure can be stale).
  const openRef = useRef(open);
  openRef.current = open;
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // Closing: blur the drafts (commits them) so the keyboard never lingers
  // over the list behind the sheet.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Keyboard WITH the slide (see quick-add): the body mounts in this
      // commit, so focus now; the settle focus below is only a backstop.
      titleRef.current?.focus();
    }
    if (!open && wasOpen.current) {
      titleRef.current?.blur();
      notesRef.current?.blur();
      // Belt and braces: after a drag-dismiss the blur alone left the
      // keyboard standing over the list (observed 2026-10-20).
      Keyboard.dismiss();
    }
    wasOpen.current = open;
  }, [open]);

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

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            // Drop the keyboard WHILE the inputs are still mounted. On a
            // drag-dismiss the sheet tears its body down (mountChildren
            // "open") before the host's `open` flips, so the close effect
            // below finds no focused input to blur and iOS keeps the keyboard
            // standing over the list (observed 2026-10-20).
            titleRef.current?.blur();
            notesRef.current?.blur();
            Keyboard.dismiss();
          }
          onOpenChange(next);
        }}
        // No header, no footer: the title row IS the header and nothing needs
        // submitting. FIT-sized (not `scrollable`): the scrollable mode pins
        // the body between two edge dividers (the stray lines at the top and
        // bottom of the sheet, 2026-10-20) and makes a downward drag scroll
        // instead of dismiss. In fit mode the whole frame is the drag surface
        // — swipe down anywhere to close, like the quick-add — and the kit's
        // keyboard spacer grows the frame with the keyboard. Long subtask
        // lists scroll inside their own capped region below.
        hideFooter
        mountChildren="open"
        onSettled={() => {
          // The kit reports a settle for the CLOSE slide too. Focusing then
          // raised the keyboard over the list as the sheet left (and with no
          // mounted input to blur it stayed) — only act on an OPEN settle.
          if (!openRef.current) return;
          setHeavyReady(true);
          // Keyboard once the slide lands: the title is the thing you most
          // often came to change. Deferred a tick — called synchronously from
          // the settle callback the focus sometimes landed before the input
          // was ready and the keyboard stayed down. NOT RN `autoFocus`: that
          // re-fired on the frame re-measure a drag triggers, re-raising the
          // keyboard as the sheet was being dismissed (2026-10-20).
          setTimeout(() => {
            const el = titleRef.current;
            if (!el) return;
            // Opened from a closing menu/sheet the field can end up FOCUSED
            // with the keyboard down (caret, no keys) — a plain focus() is a
            // no-op then, so always cycle it (a 30 ms blur is invisible).
            el.blur();
            setTimeout(() => el.focus(), 30);
          }, 80);
        }}
        // The kit FormSheet defaults to `disableDrag` (a form should not be
        // swiped away mid-edit). Nothing here is lost on close — every field
        // commits on its own — so swipe-to-dismiss is the right affordance.
        disableDrag={false}
        // Our own grabber below (a plain View the sheet's pan responder can
        // own) instead of the kit's hairline handle.
        hideHandle
        frameProps={{ pt: "$2", pb: "$4" }}
      >
        <YStack gap="$2.5">
          {/* DRAG ZONE. Tamagui's sheet only claims a pan that starts on a
              view nothing else wants — a TextInput (title, notes) or a
              ScrollView (pills, subtasks) takes the touch first, so with the
              title autofocused most of this sheet can't be dragged. This
              full-width strip is plain, so a swipe that starts here always
              drags the sheet down to dismiss; tapping the dimmed page above
              is the other way out. */}
          <View
            aria-label="Drag to close"
            height={22}
            mt={-4}
            items="center"
            justify="center"
            // KEYBOARD FIRST, THEN DRAG. A finger landing on the grabber while
            // the keyboard is up drops the keyboard (touch-start runs before
            // the pan); the kit's keyboard spacer then collapses the frame
            // under the finger, which cancels that gesture — so the first
            // swipe clears the keyboard and the next one closes the sheet.
            // Dragging through the collapse instead raced the re-measure and
            // sometimes closed the sheet with the keyboard left standing
            // over the list (2026-10-20). Tapping the dimmed page above always
            // closes in one go.
            onTouchStart={() => {
              if (!Keyboard.isVisible()) return;
              titleRef.current?.blur();
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
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="More actions"
              onPress={onMore}
            >
              <MoreHorizontal size={18} />
            </IconButton>
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
              onPress={() => openPicker(setPriorityOpen)}
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
                onPress={() => openPicker(setListOpen)}
              />
            ) : null}
            {/* Dates = the kit QuickDatePicker (same control as the quick-add
                and the web form). Touch-down drops the keyboard so the
                picker's sheet isn't hidden behind the keys. */}
            <RNView onTouchStart={() => Keyboard.dismiss()}>
              <QuickDatePicker
                size="sm"
                placeholder="Do"
                value={
                  todo.doDate ? parseLocalDay(todo.doDate.slice(0, 10)) : null
                }
                onChange={(d) =>
                  onPatch({ doDate: d ? format(d, "yyyy-MM-dd") : null })
                }
              />
            </RNView>
            <RNView onTouchStart={() => Keyboard.dismiss()}>
              <QuickDatePicker
                size="sm"
                placeholder="Deadline"
                value={
                  todo.dueDate ? parseLocalDay(todo.dueDate.slice(0, 10)) : null
                }
                onChange={(d) =>
                  onPatch({ dueDate: d ? format(d, "yyyy-MM-dd") : null })
                }
              />
            </RNView>
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
        {heavyReady || priorityOpen ? (
          <PillPickerSheet
            open={priorityOpen}
            onOpenChange={setPriorityOpen}
            title="Priority"
            options={priorityOptions}
            value={todo.priority}
            onSelect={(v) => onPatch({ priority: v as Todo["priority"] })}
          />
        ) : null}
        {heavyReady || listOpen ? (
          <PillPickerSheet
            open={listOpen}
            onOpenChange={setListOpen}
            title="List"
            options={listOptions}
            value={todo.listId}
            onSelect={(v) => onPatch({ listId: v })}
          />
        ) : null}
      </FormSheet>
    </>
  );
}
