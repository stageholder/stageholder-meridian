// packages/features/src/todos/quick-add-todo-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a todo on native. Type a title
// (smart NL parse fills the pills + shows removable chips); everything else is
// a pill with a default: Priority/List are kit Pills (QuickAddPill) opening a
// PillPickerSheet; the dates are the kit QuickDatePicker (same as the web
// form). Picker sheets are NESTED in the sheet (stacking). Create-only.
import { useEffect, useRef, useState } from "react";
import { Keyboard, TextInput, View as RNView } from "react-native";
import { format } from "date-fns";
import { Inbox } from "@tamagui/lucide-icons-2/icons/Inbox";
import { StickyNote } from "@tamagui/lucide-icons-2/icons/StickyNote";
import {
  parseSmartTodo,
  type SmartParseResult,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import { TextArea, View } from "@stageholder/ui";
import { QuickDatePicker } from "@stageholder/ui/pickers";
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

// Must match `FIELD_HEIGHT` + the editor CSS (`padding: 10px 12px; font-size:
// 16px; line-height: 22px`) in smart-todo-input.native.tsx: the sheet is
// `fit`-sized, so the stand-in has to occupy exactly the editor's box or the
// frame would jump when the editor swaps in.
/** Parse a `yyyy-MM-dd` string as the LOCAL day (Calendar speaks `Date`). */
function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}

/** Picker sheets slide up from the screen bottom — under an open keyboard
 *  they'd be hidden behind the keys (2026-10-21). Drop the keyboard first. */
function openPicker(set: (open: boolean) => void) {
  Keyboard.dismiss();
  set(true);
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
  const noteRef = useRef<TextInput>(null);
  // Note pill → the field mounts in this commit, so focus it on the next
  // tick; toggling it off hands the keyboard back to the title.
  useEffect(() => {
    const t = setTimeout(
      () => (noteOpen ? noteRef.current : titleRef.current)?.focus(),
      50,
    );
    return () => clearTimeout(t);
  }, [noteOpen]);
  const [priority, setPriority] = useState(makeTodoFormDefaults().priority);
  const [doDate, setDoDate] = useState(makeTodoFormDefaults().doDate ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "");
  const [listId, setListId] = useState(defaultListId);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // OPEN CHOREOGRAPHY: the title is a native TextInput (light — it mounts in
  // the open commit) but the pickers are four SIBLING sheets; mounting those
  // in the create sheet's open commit left the screen dimmed for ~2.7 s before
  // the sheet slid up on the first open (measured, Android release). They
  // mount once the kit reports the slide has SETTLED (FormSheet `onSettled`,
  // kit 0.4.0-alpha.2: spring complete or its 350 ms cap), and the title is
  // focused from that same signal so the keyboard rises the moment the sheet
  // lands — never from a timer. Latched: a reopen renders everything at once.
  // (The field used to be a WebView editor gated behind a stand-in here; see
  // smart-todo-input.native.tsx for why that was replaced, 2026-10-20.)
  const [heavyReady, setHeavyReady] = useState(false);

  // Reset by STATE on each fresh open (open false→true) — no remount key.
  // Starts FALSE, not `open`: hosts mount this sheet in the same commit as
  // their first open (`useMountOnOpen` — Today palette, habits/todos tabs), so
  // the first render already has `open === true`. Seeding the ref with `open`
  // skipped this effect on that first open (no reset; 2026-10-20).
  const wasOpen = useRef(false);
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
      // Keyboard WITH the slide: focus in the open commit (the field is a
      // native TextInput mounted in this same commit). Focusing only on the
      // kit's settle signal (~350 ms later) read as a visible lag between the
      // sheet landing and the keyboard rising (2026-10-21). The settle focus
      // below stays as a backstop for the first-ever open.
      titleRef.current?.focus();
    } else if (!open && wasOpen.current) {
      // Closing (submit, swipe-down, tap-out): the field stays mounted after
      // the first open, so blur it explicitly — otherwise the keyboard stayed
      // up over the list behind the closed sheet and ate the next touch.
      titleRef.current?.blur();
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
        onSettled={() => {
          setHeavyReady(true);
          // Keyboard the moment the slide lands (kit's real settle signal).
          titleRef.current?.focus();
        }}
        field={
          <>
            {/* testID wrapper kept for the E2E flows (Maestro taps it). */}
            <View testID="quick-add-todo-title">
              <SmartTodoInput
                ref={titleRef}
                value={title}
                onValueChange={setTitle}
                lists={listRefs}
                locale={smartLocale}
                parse
                // The field highlights recognized phrases inline; `onParse`
                // additionally lifts them into the pill row below so a manual
                // pick and a typed token stay in sync.
                onParse={applyParse}
                onSubmit={handleSubmit}
                placeholder="What needs to be done?"
              />
            </View>
            {noteOpen ? (
              <TextArea
                ref={noteRef as never}
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
            {/* Dates = the kit QuickDatePicker (presets + calendar in its own
                sheet), the SAME control the web form uses — not a hand-rolled
                CalendarSheet. The touch-down wrapper drops the keyboard so its
                sheet isn't hidden behind the keys; a pick closes it, and
                `refocus` brings the keyboard back like the pill pickers do. */}
            <RNView onTouchStart={() => Keyboard.dismiss()}>
              <QuickDatePicker
                size="sm"
                placeholder="Do"
                value={doDate ? parseLocalDay(doDate) : null}
                onChange={(d) => {
                  setDoDate(d ? format(d, "yyyy-MM-dd") : "");
                  refocus();
                }}
              />
            </RNView>
            <RNView onTouchStart={() => Keyboard.dismiss()}>
              <QuickDatePicker
                size="sm"
                placeholder="Deadline"
                value={dueDate ? parseLocalDay(dueDate) : null}
                onChange={(d) => {
                  setDueDate(d ? format(d, "yyyy-MM-dd") : "");
                  refocus();
                }}
              />
            </RNView>
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              onPress={() => setNoteOpen((v) => !v)}
            />
          </>
        }
      >
        {heavyReady || priorityOpen ? (
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
        ) : null}
        {heavyReady || listOpen ? (
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
        ) : null}
      </QuickAddSheet>
    </>
  );
}
