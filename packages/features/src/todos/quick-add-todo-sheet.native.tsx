// packages/features/src/todos/quick-add-todo-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a todo on native: a title with
// smart parsing, a pill row (priority / list / do / deadline / note) and an
// accent send button. Create-only; editing is the detail sheet.
//
// ONE RULE keeps it predictable: every open is a FRESH instance (a child of
// the sheet, which unmounts it at close). So there
// is no reset code, no open/closed refs, no focus timers — initial state is
// the reset, `autoFocus` raises the keyboard with the slide, and the keyboard
// drops because the field is gone.
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Inbox } from "@tamagui/lucide-icons-2/icons/Inbox";
import { StickyNote } from "@tamagui/lucide-icons-2/icons/StickyNote";
import {
  parseSmartTodo,
  type SmartParseResult,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import { TextArea, View } from "@stageholder/ui";
import {
  QuickAddBody,
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
import { ComposerSheet } from "../_internal/composer-sheet.native";
import { DatePill, DatePickerSheet } from "../_internal/date-pill.native";
import { openAfterKeyboard } from "../_internal/open-after-keyboard.native";
import { SmartTodoInput } from "./smart-todo-input";
import type { SmartTodoInputHandle } from "./smart-todo-input.types";
import { makeTodoFormDefaults } from "./todo-form";
import type { QuickAddTodoSheetProps } from "./quick-add-todo-sheet.types";

/** Priority dot colors — fixed brand swatches (from todo-form.tsx). */
const PRIORITY_DOT: Record<string, string> = {
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};
const PRIORITY_KEYS = ["none", "low", "medium", "high", "urgent"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Small color dot used as a pill / option leading icon. The prop is `tint`
 * (NOT `color`): the kit `Pill` clones its icon and injects `color`, which
 * would clobber a `color` prop.
 */
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

/** Parse a `yyyy-MM-dd` string as the LOCAL day (the picker speaks `Date`). */
function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}

export function QuickAddTodoSheet(props: QuickAddTodoSheetProps) {
  // Stable shell; the state component below is a CHILD of the sheet, so the
  // kit's `open` policy unmounts it at close and mounts it fresh at open —
  // initial state is the reset.
  return (
    <ComposerSheet open={props.open} onOpenChange={props.onOpenChange}>
      <TodoQuickAdd {...props} />
    </ComposerSheet>
  );
}

function TodoQuickAdd({
  open,
  onOpenChange,
  lists,
  defaultDueDate,
  accentColor,
  isSubmitting,
  onSubmit,
}: QuickAddTodoSheetProps) {
  const smartLocale = useRef(resolveSmartLocale()).current;
  const titleRef = useRef<SmartTodoInputHandle>(null);

  const defaultListId =
    lists?.find((l) => l.isDefault)?.id || lists?.[0]?.id || "";
  const showListPill = !!lists && lists.length > 1;
  const listRefs = (lists ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    isDefault: l.isDefault,
  }));

  const defaults = makeTodoFormDefaults();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [priority, setPriority] = useState(defaults.priority);
  const [doDate, setDoDate] = useState(defaults.doDate ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "");
  const [listId, setListId] = useState(defaultListId);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [doOpen, setDoOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  // Keyboard with the slide: when the sheet opens, focus the field one
  // animation frame later (the kit mounts the field at open and attaches it
  // a beat after; the frame callback is cancelled on close/unmount).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Bring the keyboard back to the title after a picker closes.
  const refocus = () => titleRef.current?.focus();

  // Typing a token SETS the matching pill, never wipes a manual pick.
  function applyParse(r: SmartParseResult) {
    if (r.doDate) setDoDate(r.doDate);
    if (r.dueDate) setDueDate(r.dueDate);
    if (r.priority) setPriority(r.priority);
    if (r.listId) setListId(r.listId);
  }

  // One submit at a time. Android fires `onSubmitEditing` TWICE for a single
  // Enter on a multiline input with `submitBehavior="submit"` (editor action
  // + key event), which created every todo twice. The lock is taken
  // synchronously on the first event and released only when the host's
  // `isSubmitting` falls again (a FAILED create — a successful one closes
  // the sheet, and the next open is a fresh instance). The host's mutate is
  // fire-and-forget, so a promise-based release would reopen the window
  // before the echo arrives.
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
    const cleanTitle = parseSmartTodo(title, {
      lists: listRefs,
      now: new Date(),
      locale: smartLocale,
    }).title;
    if (!cleanTitle) return;
    submitLock.current = true;
    void onSubmit({
      title: cleanTitle,
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      doDate: doDate || undefined,
      listId: listId || defaultListId || undefined,
    });
  }

  const selectedList = lists?.find((l) => l.id === (listId || defaultListId));

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

  return (
    <QuickAddBody
      title="New Todo"
      accentColor={accentColor}
      onSubmit={handleSubmit}
      submitting={isSubmitting}
      submitDisabled={!title.trim()}
      field={
        <>
          {/* testID wrapper kept for the E2E flows (Maestro taps it). */}
          <View testID="quick-add-todo-title">
            <SmartTodoInput
              ref={titleRef}
              autoFocus
              value={title}
              onValueChange={setTitle}
              lists={listRefs}
              locale={smartLocale}
              parse
              onParse={applyParse}
              onSubmit={handleSubmit}
              placeholder="What needs to be done?"
            />
          </View>
          {noteOpen ? (
            <TextArea
              autoFocus
              value={description}
              onChangeText={setDescription}
              placeholder="Add note…"
              rows={2}
              height={"auto" as never}
            />
          ) : null}
        </>
      }
      pills={
        <>
          <QuickAddPill
            icon={
              priority !== "none" ? (
                <Dot tint={PRIORITY_DOT[priority]} />
              ) : undefined
            }
            label={priority === "none" ? "Priority" : cap(priority)}
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
          {/* Dates = the app's DatePill + nested DatePickerSheet (below) —
              same pattern as Priority/List. The pill drops the keyboard
              before its sheet opens; a pick closes it and the title refocuses. */}
          <DatePill
            placeholder="Do"
            value={doDate ? parseLocalDay(doDate) : null}
            onPress={() => openAfterKeyboard(setDoOpen)}
          />
          <DatePill
            placeholder="Deadline"
            value={dueDate ? parseLocalDay(dueDate) : null}
            onPress={() => openAfterKeyboard(setDueOpen)}
          />
          {/* Note: the field mounts with `autoFocus`; closing it hands the
              keyboard back to the title. */}
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
        <PillPickerSheet
          open={priorityOpen}
          onOpenChange={(o) => {
            setPriorityOpen(o);
            if (!o) refocus();
          }}
          title="Priority"
          options={priorityOptions}
          value={priority}
          onSelect={setPriority}
        />
      }
      {
        <PillPickerSheet
          open={listOpen}
          onOpenChange={(o) => {
            setListOpen(o);
            if (!o) refocus();
          }}
          title="List"
          options={listOptions}
          value={listId || defaultListId}
          onSelect={setListId}
        />
      }
      {
        <DatePickerSheet
          open={doOpen}
          onOpenChange={(o) => {
            setDoOpen(o);
            if (!o) refocus();
          }}
          title="Do date"
          value={doDate ? parseLocalDay(doDate) : null}
          onChange={(d) => setDoDate(d ? format(d, "yyyy-MM-dd") : "")}
        />
      }
      {
        <DatePickerSheet
          open={dueOpen}
          onOpenChange={(o) => {
            setDueOpen(o);
            if (!o) refocus();
          }}
          title="Deadline"
          value={dueDate ? parseLocalDay(dueDate) : null}
          onChange={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
        />
      }
    </QuickAddBody>
  );
}
