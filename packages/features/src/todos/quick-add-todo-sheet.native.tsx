// packages/features/src/todos/quick-add-todo-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a todo on native. Type a title
// (smart NL parse fills the pills + shows removable chips); everything else is
// a pill with a default. EVERY pill is the kit `Pill` (via QuickAddPill) so
// they are all one size: Priority/List open a PillPickerSheet; the dates open a
// kit CalendarSheet (sibling, quick presets). Create-only; EDIT keeps TodoForm.
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Flag, Inbox, StickyNote } from "@tamagui/lucide-icons-2";
import {
  parseSmartTodo,
  type SmartParseResult,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import { CalendarSheet, TextArea, View } from "@stageholder/ui";
import {
  QuickAddSheet,
  QuickAddPill,
  PillPickerSheet,
  type PillPickerOption,
} from "../_internal/quick-add-sheet.native";
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
 * (NOT `color`) on purpose: the kit `Pill` clones its icon and injects
 * `color={foreground}`, which would clobber a `color` prop and make the dot's
 * backgroundColor a theme token → invisible. `tint` is never cloned over.
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

/** Parse a `yyyy-MM-dd` string as the LOCAL day (Calendar speaks `Date`). */
function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}
/** Compact display label for a `yyyy-MM-dd` value. */
function fmtDate(iso: string): string {
  return format(parseLocalDay(iso), "d MMM yyyy");
}

export function QuickAddTodoSheet({
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [priority, setPriority] = useState(makeTodoFormDefaults().priority);
  const [doDate, setDoDate] = useState(makeTodoFormDefaults().doDate ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "");
  const [listId, setListId] = useState(defaultListId);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [doOpen, setDoOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  // Reset by STATE on each fresh open (open false→true) — no remount key.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const d = makeTodoFormDefaults();
      setTitle("");
      setDescription("");
      setNoteOpen(false);
      setPriority(d.priority);
      setDoDate(d.doDate ?? "");
      setDueDate(defaultDueDate ?? "");
      setListId(defaultListId);
      setTimeout(() => titleRef.current?.focus(), 350);
    }
    wasOpen.current = open;
  }, [open, defaultDueDate, defaultListId]);

  // Keep-keyboard-up: refocus the title after a picker closes.
  const refocus = () => setTimeout(() => titleRef.current?.focus(), 300);

  // Non-clearing sync: typing a token SETS the matching pill, never wipes a
  // manually-picked value (from todo-form.tsx `applyParse`).
  function applyParse(r: SmartParseResult) {
    if (r.doDate) setDoDate(r.doDate);
    if (r.dueDate) setDueDate(r.dueDate);
    if (r.priority) setPriority(r.priority);
    if (r.listId) setListId(r.listId);
  }

  function handleSubmit() {
    const cleanTitle = parseSmartTodo(title, {
      lists: listRefs,
      now: new Date(),
      locale: smartLocale,
    }).title;
    if (!cleanTitle) return;
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
    <>
      <QuickAddSheet
        open={open}
        onOpenChange={onOpenChange}
        title="New Todo"
        accentColor={accentColor}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
        submitDisabled={!title.trim()}
        field={
          <>
            <SmartTodoInput
              ref={titleRef}
              value={title}
              onValueChange={setTitle}
              lists={listRefs}
              locale={smartLocale}
              parse
              // The field highlights recognized phrases inline (rounded pills,
              // Todoist-style); `onParse` additionally lifts them into the pill
              // row below so a manual pick and a typed token stay in sync.
              onParse={applyParse}
              onSubmit={handleSubmit}
              placeholder="What needs to be done?"
            />
            {noteOpen ? (
              <TextArea
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
              onPress={() => setPriorityOpen(true)}
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
                onPress={() => setListOpen(true)}
              />
            ) : null}
            <QuickAddPill
              icon={<CalendarDays size={13} />}
              label={doDate ? fmtDate(doDate) : "Do"}
              onPress={() => setDoOpen(true)}
            />
            <QuickAddPill
              icon={<Flag size={13} />}
              label={dueDate ? fmtDate(dueDate) : "Deadline"}
              onPress={() => setDueOpen(true)}
            />
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              onPress={() => setNoteOpen((v) => !v)}
            />
          </>
        }
      />

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
      <CalendarSheet
        open={doOpen}
        onClose={() => {
          setDoOpen(false);
          refocus();
        }}
        value={doDate ? parseLocalDay(doDate) : null}
        onSelect={(d) => {
          setDoDate(d ? format(d, "yyyy-MM-dd") : "");
          setDoOpen(false);
        }}
        title="Do date"
      />
      <CalendarSheet
        open={dueOpen}
        onClose={() => {
          setDueOpen(false);
          refocus();
        }}
        value={dueDate ? parseLocalDay(dueDate) : null}
        onSelect={(d) => {
          setDueDate(d ? format(d, "yyyy-MM-dd") : "");
          setDueOpen(false);
        }}
        title="Deadline"
      />
    </>
  );
}
