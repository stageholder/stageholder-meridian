# Native Compact Quick-Add (Todo + Habit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native (mobile) todo + habit **create** sheets with a Todoist-style compact quick-add — one field to type, everything else a pill with a sensible default — and delete the create-path scaffolding.

**Architecture:** Two native-only sheets in `@repo/features` built on a shared `QuickAddSheet` shell that wraps the kit `FormSheet` (keyboard-stretch handling). The sheets **recompose already-proven controls** from the existing `TodoForm`/`HabitForm` (`SmartTodoInput`, `Select` with `pill`+`inSheet`, `QuickDatePicker`, `MediaPickerSheet`, `ToggleGroup`, `NumberInput`, swatch row) into a compact layout: primary field + a `FormSheet.HorizontalScroll` pill row + a pinned accent send button. No new pickers are invented; habit sub-config (weekly days, target, color) moves into small nested picker sheets that host the reused controls.

**Tech Stack:** React Native (Expo), Tamagui v2, `@stageholder/ui` (kit), `@repo/features`, `@repo/core` (smart-parse). Package manager/runtime: Bun.

## Global Constraints

- **Native only.** All new files are `.native.tsx`. The PWA and the shared `TodoForm`/`HabitForm` are NOT modified.
- **Create only.** Edit dialogs, `todo-list-sheet`, `habit-group-sheet` are NOT modified; their existing `mountChildren="open"` pins stay.
- **No automated tests** — manual verification only (project preference). No test steps in this plan.
- **No git operations** — the user commits. No `git` steps in this plan.
- **No build/tsc during implementation** — the user runs the build at end-of-work QA. No build steps.
- **Kit rules:** menu pickers inside a Sheet use `Select ... inSheet={true}` on native (`isWeb ? undefined : true`); `Select.Trigger` gets `pill width={"auto" as never} minWidth={110}` (native label-collapse stopgap); nested sheets use `snapPointsMode` `fit`/`constant` (never percent) + `transition="medium"`; `MediaPickerSheet` already stacks above a form sheet (zIndex 1e5).
- **Reset by state, not unmount.** No epoch/id remount keys, no `Sheet.LazyBody`, no `FormSheetSkeleton`, no `mountChildren` juggling in the new create path.
- **Accent send** button uses the passed hex (`IGNITION.todo.base` / `IGNITION.habit.base`), white glyph, via the `style`/`hoverStyle`/`pressStyle` hatch (no kit token) — same treatment as the current forms' submit button.
- Keep files under 500 lines; validate at boundaries; read a file before editing it.

---

## File Structure

**New (all native-only):**

- `packages/features/src/_internal/quick-add-sheet.native.tsx` — `<QuickAddSheet>` shell + `QuickAddPill` helper. One responsibility: compact FormSheet chrome (title, pinned pill row + accent send, keyboard).
- `packages/features/src/todos/quick-add-todo-sheet.native.tsx` — `<QuickAddTodoSheet>`. Todo create body + pills.
- `packages/features/src/habits/quick-add-habit-sheet.native.tsx` — `<QuickAddHabitSheet>` + its nested `FrequencyPickerSheet` / `TargetPickerSheet` / `ColorPickerSheet`. Habit create body + pills.

**Modified:**

- `packages/features/src/todos/index.ts` — export `QuickAddTodoSheet` + types.
- `packages/features/src/habits/index.ts` — export `QuickAddHabitSheet` + types.
- `apps/mobile/components/create-todo-dialog.tsx` — render `QuickAddTodoSheet`; delete scaffolding.
- `apps/mobile/components/create-habit-dialog.tsx` — render `QuickAddHabitSheet`; delete scaffolding.

**Reference (read, do not modify) — the proven patterns to copy from:**

- `packages/features/src/todos/todo-form.tsx` (SmartTodoInput wiring, `applyParse`, `DateChip`, Priority/List `Select` pills, submit handler, `makeTodoFormDefaults`).
- `packages/features/src/habits/habit-form.tsx` (icon `MediaPickerSheet` + `renderIconTrigger`, Frequency/Group `Select`, target `Input`, weekly `ToggleGroup`, `NumberInput`, color swatch row, `HABIT_FORM_DEFAULTS`, `DAY_OPTIONS`, `COLOR_OPTIONS`, `icon-value` helpers).

---

## Task 1: `QuickAddSheet` shell + `QuickAddPill`

**Files:**

- Create: `packages/features/src/_internal/quick-add-sheet.native.tsx`

**Interfaces:**

- Produces:
  - `QuickAddSheet` component with props:
    ```ts
    export interface QuickAddSheetProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      title: string;
      accentColor: string;
      /** Fires the create. Does NOT auto-close — the host closes on success. */
      onSubmit: () => void;
      submitting?: boolean;
      submitDisabled?: boolean;
      /** Primary field slot (smart title / icon+name) + any inline-expanded Note. */
      field: React.ReactNode;
      /** Pill row content (Select-pills, QuickDatePicker, QuickAddPill…). */
      pills: React.ReactNode;
    }
    ```
  - `QuickAddPill` component with props:
    ```ts
    export interface QuickAddPillProps {
      icon?: React.ReactNode;
      label: string;
      selected?: boolean;
      onPress: () => void;
    }
    ```

- [ ] **Step 1: Create the file with the shell + pill helper**

`QuickAddSheet` wraps the kit `FormSheet` with `hideFooter` (the action is the pinned send button, legitimate per the design). The body is `field` (top) then a pinned action bar: the `pills` inside `FormSheet.HorizontalScroll` on the left, an accent circular send `Button` on the right. `fit` sizing (no `scrollable`, no `snapPoints`). `QuickAddPill` is a thin wrapper over the kit `Pill` for actions that open a custom sheet (Note/Color/Frequency/Target).

```tsx
// packages/features/src/_internal/quick-add-sheet.native.tsx  (NATIVE)
//
// Compact "quick-add" shell for the native create flows (todo + habit).
// Wraps the kit FormSheet for its keyboard-stretch handling, but renders a
// MINIMAL body: a primary field + a horizontally-scrolling pill row with a
// pinned accent send button. Todoist-style quick capture — one thing to type,
// everything else a pill. Reset is by state (host owns it); no LazyBody/
// skeleton/epoch keys/mountChildren juggling.
import type { ReactNode } from "react";
import { ArrowUp } from "@tamagui/lucide-icons-2";
import { Button, FormSheet, Pill, XStack, YStack } from "@stageholder/ui";

export interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  accentColor: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  field: ReactNode;
  pills: ReactNode;
}

export function QuickAddSheet({
  open,
  onOpenChange,
  title,
  accentColor,
  onSubmit,
  submitting,
  submitDisabled,
  field,
  pills,
}: QuickAddSheetProps) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      // Compact: the send button is the action, so hide the kit footer. fit
      // sizing hugs the small body; no scrollable/snapPoints. Reset is by
      // state in the host, so the default warm mount policy is fine.
      hideFooter
    >
      <YStack gap="$3">
        {field}
        <XStack items="center" gap="$2">
          <FormSheet.HorizontalScroll>{pills}</FormSheet.HorizontalScroll>
          <Button
            circular
            size="lg"
            icon={<ArrowUp size={20} color={"#ffffff" as never} />}
            borderWidth={0}
            style={{ backgroundColor: accentColor }}
            pressStyle={
              { backgroundColor: accentColor, opacity: 0.82 } as never
            }
            disabled={submitDisabled || submitting}
            loading={submitting}
            onPress={onSubmit}
          />
        </XStack>
      </YStack>
    </FormSheet>
  );
}

export interface QuickAddPillProps {
  icon?: ReactNode;
  label: string;
  selected?: boolean;
  onPress: () => void;
}

/** A pill that opens a custom picker (Note/Color/Frequency/Target) — for menu
 *  pills prefer the kit `Select` with a `pill` trigger (proven in TodoForm). */
export function QuickAddPill({
  icon,
  label,
  selected,
  onPress,
}: QuickAddPillProps) {
  return (
    <Pill size="sm" icon={icon} selected={selected} onPress={onPress}>
      {label}
    </Pill>
  );
}
```

- [ ] **Step 2: Verify `FormSheet.HorizontalScroll`, `Pill`, and `Button circular` prop names against the installed kit**

Run: `grep -rn "HorizontalScroll\|circular" packages/ui/dist/jsx/_public.mjs` in `~/Project/stageholder-ui` OR check `packages/ui/src/components/FormSheet.shared.tsx` (HorizontalScroll) and `Button.tsx` (`circular`/`icon` props).
Expected: `FormSheet.HorizontalScroll` is exported off FormSheet; `Button` accepts `circular` + `icon`. If `circular` isn't a prop, use a fixed `width`/`height` + `rounded={9999}` instead.

- [ ] **Step 3: Manual verification (deferred to Task 2/3 render)**

The shell has no standalone screen; it's verified when a consuming sheet renders (Task 2). Confirm the file has no unresolved imports by reading it back.

---

## Task 2: `QuickAddTodoSheet`

**Files:**

- Create: `packages/features/src/todos/quick-add-todo-sheet.native.tsx`
- Modify: `packages/features/src/todos/index.ts`

**Interfaces:**

- Consumes: `QuickAddSheet`, `QuickAddPill` (Task 1); `SmartTodoInput`, `SmartTodoInputHandle`, `TodoFormValues`, `TodoListChoice`, `makeTodoFormDefaults` (existing `todo-form.tsx` / `smart-todo-input`); `parseSmartTodo` (`@repo/core/todos/smart-parse`); `resolveSmartLocale` (`@repo/core/todos/date-parse`).
- Produces:

  ```ts
  export interface QuickAddTodoSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lists?: TodoListChoice[];
    /** Seed for the do-date (e.g. selected calendar day) — yyyy-MM-dd. */
    defaultDoDate?: string;
    accentColor: string;
    isSubmitting?: boolean;
    onSubmit: (values: TodoFormValues) => void | Promise<void>;
  }
  export function QuickAddTodoSheet(props: QuickAddTodoSheetProps): JSX.Element;
  ```

- [ ] **Step 1: Create the component**

Body = `SmartTodoInput` (no Label; `showChips={false}` because the pills ARE the feedback; `onParse` syncs the pill state via a non-clearing `applyParse` copied from `todo-form.tsx:177-182`) + a Note pill that toggles an inline `TextArea`. Pills = Priority `Select` pill + List `Select` pill (both copied from `todo-form.tsx:266-402`, `inSheet={true}` on native) + two `QuickDatePicker size="sm"` date pills (Do/Deadline, the `DateChip` from `todo-form.tsx:92-109`) + a Note `QuickAddPill`. Reset to defaults on the open `false→true` transition. Submit strips smart tokens (copied from `todo-form.tsx:191-211`) and calls `onSubmit`; the host closes on success.

```tsx
// packages/features/src/todos/quick-add-todo-sheet.native.tsx  (NATIVE)
//
// Compact Todoist-style quick-add for creating a todo on native. Type a title
// (smart NL parse fills the pills); everything else is a pill with a default.
// Recomposes the proven controls from todo-form.tsx into the QuickAddSheet
// shell — no new pickers. Create-only (edit keeps the full TodoForm).
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Inbox, StickyNote } from "@tamagui/lucide-icons-2";
import {
  parseSmartTodo,
  type SmartParseResult,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import {
  QuickDatePicker,
  Select,
  Text,
  TextArea,
  View,
  XStack,
} from "@stageholder/ui";
import {
  QuickAddSheet,
  QuickAddPill,
} from "../_internal/quick-add-sheet.native";
import { SmartTodoInput } from "./smart-todo-input";
import type { SmartTodoInputHandle } from "./smart-todo-input.types";
import {
  makeTodoFormDefaults,
  type TodoFormValues,
  type TodoListChoice,
} from "./todo-form";

const PRIORITY_DOT: Record<string, string> = {
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};

function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}

export interface QuickAddTodoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists?: TodoListChoice[];
  defaultDoDate?: string;
  accentColor: string;
  isSubmitting?: boolean;
  onSubmit: (values: TodoFormValues) => void | Promise<void>;
}

export function QuickAddTodoSheet({
  open,
  onOpenChange,
  lists,
  defaultDoDate,
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
  const [priority, setPriority] = useState("low");
  const [doDate, setDoDate] = useState(defaultDoDate ?? "");
  const [dueDate, setDueDate] = useState("");
  const [listId, setListId] = useState(defaultListId);

  // Reset by STATE on each fresh open (open false→true) — no remount key.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const d = makeTodoFormDefaults();
      setTitle("");
      setDescription("");
      setNoteOpen(false);
      setPriority(d.priority);
      setDoDate(defaultDoDate ?? d.doDate ?? "");
      setDueDate("");
      setListId(defaultListId);
      // Focus after the sheet settles so the keyboard doesn't jank the slide.
      setTimeout(() => titleRef.current?.focus(), 350);
    }
    wasOpen.current = open;
  }, [open, defaultDoDate, defaultListId]);

  // Non-clearing sync: typing a token SETS the matching pill, never wipes a
  // manual pick (copied from todo-form.tsx applyParse).
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

  return (
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
            showChips={false}
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
          {showListPill && lists ? (
            <Select
              size="sm"
              value={listId || defaultListId}
              onValueChange={setListId}
              inSheet
            >
              <Select.Trigger pill width={"auto" as never} minWidth={110}>
                <XStack items="center" gap="$1.5">
                  {selectedList?.isDefault ? (
                    <Inbox size={12} color="$primary" />
                  ) : selectedList ? (
                    <View
                      width={8}
                      height={8}
                      rounded={9999}
                      style={{
                        backgroundColor: selectedList.color || "#6b7280",
                      }}
                    />
                  ) : null}
                  <Text fontSize="$2" color="$color" numberOfLines={1}>
                    {selectedList?.name ?? "List"}
                  </Text>
                </XStack>
              </Select.Trigger>
              <Select.Content>
                {lists.map((list) => (
                  <Select.Item key={list.id} value={list.id}>
                    <XStack items="center" gap="$2">
                      {list.isDefault ? (
                        <Inbox size={12} color="$primary" />
                      ) : (
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: list.color || "#6b7280" }}
                        />
                      )}
                      <Select.ItemText>{list.name}</Select.ItemText>
                    </XStack>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          ) : null}

          <Select
            size="sm"
            value={priority}
            onValueChange={setPriority}
            inSheet
          >
            <Select.Trigger pill width={"auto" as never} minWidth={110}>
              <XStack items="center" gap="$1.5">
                {priority !== "none" ? (
                  <View
                    width={8}
                    height={8}
                    rounded={9999}
                    style={{ backgroundColor: PRIORITY_DOT[priority] }}
                  />
                ) : null}
                <Text
                  fontSize="$2"
                  color={priority === "none" ? "$mutedForeground" : "$color"}
                  numberOfLines={1}
                >
                  {priority === "none"
                    ? "Priority"
                    : priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Text>
              </XStack>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">None</Select.Item>
              {(["low", "medium", "high", "urgent"] as const).map((key) => (
                <Select.Item key={key} value={key}>
                  <XStack items="center" gap="$2">
                    <View
                      width={8}
                      height={8}
                      rounded={9999}
                      style={{ backgroundColor: PRIORITY_DOT[key] }}
                    />
                    <Select.ItemText>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Select.ItemText>
                  </XStack>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <QuickDatePicker
            size="sm"
            value={doDate ? parseLocalDay(doDate) : null}
            onChange={(d) => setDoDate(d ? format(d, "yyyy-MM-dd") : "")}
            placeholder="Do"
          />
          <QuickDatePicker
            size="sm"
            value={dueDate ? parseLocalDay(dueDate) : null}
            onChange={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
            placeholder="Deadline"
          />

          <QuickAddPill
            icon={<StickyNote size={13} />}
            label="Note"
            selected={noteOpen || description.trim().length > 0}
            onPress={() => setNoteOpen((v) => !v)}
          />
        </>
      }
    />
  );
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/features/src/todos/index.ts`, add:

```ts
export { QuickAddTodoSheet } from "./quick-add-todo-sheet.native";
export type { QuickAddTodoSheetProps } from "./quick-add-todo-sheet.native";
```

(Confirm the barrel's existing export style first; match it. Native-only export is intentional — the PWA does not import this.)

- [ ] **Step 3: Manual verification (device/simulator)**

Temporarily render `<QuickAddTodoSheet>` from `create-todo-dialog` (Task 4 wires it properly) OR verify in Task 4. Check: title autofocuses; typing "gym tomorrow 7am p1" fills Do + Priority pills; each pill opens its picker and the keyboard returns after picking; Note pill toggles the inline TextArea; send creates + host closes; reopening shows a clean form.

---

## Task 3: `QuickAddHabitSheet` + nested picker sheets

**Files:**

- Create: `packages/features/src/habits/quick-add-habit-sheet.native.tsx`
- Modify: `packages/features/src/habits/index.ts`

**Interfaces:**

- Consumes: `QuickAddSheet`, `QuickAddPill` (Task 1); `HabitFormValues`, `HabitFormGroupOption`, `HABIT_FORM_DEFAULTS` (existing `habit-form.tsx`); `MediaPickerSheet`, `Select`, `Input`, `ToggleGroup`, `NumberInput`, `Sheet`, `Text`, `View`, `XStack`, `YStack` (kit); `encodeMediaIcon`, `parseMediaIcon` (`./icon-value`); `MediaGlyph` (kit). Reuse the `DAY_OPTIONS` / `COLOR_OPTIONS` constants (copy them from `habit-form.tsx` into this file — keep them local; do not export from `habit-form.tsx` to avoid touching it).
- Produces:

  ```ts
  export interface QuickAddHabitSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups?: HabitFormGroupOption[];
    defaultGroupId?: string | null;
    accentColor: string;
    isSubmitting?: boolean;
    onSubmit: (values: HabitFormValues) => void | Promise<void>;
  }
  export function QuickAddHabitSheet(
    props: QuickAddHabitSheetProps,
  ): JSX.Element;
  ```

- [ ] **Step 1: Create the nested picker sheets (in the same file)**

Three small kit `Sheet`s (native `snapPointsMode="fit"`, `transition="medium"`) that host the reused controls. `FrequencyPickerSheet` holds the frequency `Select` + (conditionally) the weekly `ToggleGroup` / `NumberInput`. `TargetPickerSheet` holds the count `Input` + unit `Input`. `ColorPickerSheet` holds the swatch row.

```tsx
// --- nested picker sheets (same file) ---
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
```

- [ ] **Step 2: Create the main `QuickAddHabitSheet`**

Icon box (reuse `MediaPickerSheet` + a 40×40 `MediaGlyph` trigger, copied from `habit-form.tsx:205-232` / `renderIconTrigger`) + name `Input` in the `field`. Pills = Frequency / Target / Color `QuickAddPill`s (open the nested sheets above) + Group `Select` pill (only when `groups` non-empty) + Note pill. Copy `DAY_OPTIONS` and `COLOR_OPTIONS` locally from `habit-form.tsx`. Reset-by-state on open.

```tsx
// packages/features/src/habits/quick-add-habit-sheet.native.tsx  (NATIVE)
import { useEffect, useRef, useState } from "react";
import {
  Smile,
  StickyNote,
  Repeat,
  Target,
  Palette,
  Folder,
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
  YStack,
} from "@stageholder/ui";
import {
  QuickAddSheet,
  QuickAddPill,
} from "../_internal/quick-add-sheet.native";
import { encodeMediaIcon, parseMediaIcon } from "./icon-value";
import {
  HABIT_FORM_DEFAULTS,
  type HabitFormValues,
  type HabitFormGroupOption,
} from "./habit-form";

// Copied local constants (do not touch habit-form.tsx).
const DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;
const COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#eab308", label: "Yellow" },
  { value: "#f97316", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
] as const;
const NO_GROUP_VALUE = "__none__";
// NOTE (Step 3): copy DAY_OPTIONS/COLOR_OPTIONS values VERBATIM from
// habit-form.tsx — verify they match before finishing this task.

export interface QuickAddHabitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups?: HabitFormGroupOption[];
  defaultGroupId?: string | null;
  accentColor: string;
  isSubmitting?: boolean;
  onSubmit: (values: HabitFormValues) => void | Promise<void>;
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
  const nameRef = useRef<import("react-native").TextInput>(null);

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
      ...(hasGroups ? { groupId } : {}),
    });
  }

  const freqLabel =
    frequency === "daily"
      ? "Every day"
      : frequency === "weekly"
        ? "Specific days"
        : "Times / week";
  const activeGroupName = groups?.find((g) => g.id === groupId)?.name;

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
              selected
              onPress={() => setFreqOpen(true)}
            />
            <QuickAddPill
              icon={<Target size={13} />}
              label={`${targetCount}×${unit ? ` ${unit}` : ""}`}
              selected
              onPress={() => setTargetOpen(true)}
            />
            <QuickAddPill
              icon={<Palette size={13} color={color as never} />}
              label="Color"
              selected
              onPress={() => setColorOpen(true)}
            />
            {hasGroups ? (
              <Select
                size="sm"
                value={groupId ?? NO_GROUP_VALUE}
                onValueChange={(v) =>
                  setGroupId(v === NO_GROUP_VALUE ? null : v)
                }
                inSheet
              >
                <Select.Trigger pill width={"auto" as never} minWidth={110}>
                  <XStack items="center" gap="$1.5">
                    <Folder size={12} color="$mutedForeground" />
                    <Text fontSize="$2" color="$color" numberOfLines={1}>
                      {activeGroupName ?? "Group"}
                    </Text>
                  </XStack>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NO_GROUP_VALUE}>Ungrouped</Select.Item>
                  {groups!.map((g) => (
                    <Select.Item key={g.id} value={g.id}>
                      {g.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            ) : null}
            <QuickAddPill
              icon={<StickyNote size={13} />}
              label="Note"
              selected={noteOpen || description.trim().length > 0}
              onPress={() => setNoteOpen((v) => !v)}
            />
          </>
        }
      />

      <MediaPickerSheet
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        tabs={["emoji", "icon"]}
        value={parseMediaIcon(icon)}
        onChange={(v) => {
          setIcon(v ? encodeMediaIcon(v) : "");
          setIconOpen(false);
        }}
      />
      <FrequencyPickerSheet
        open={freqOpen}
        onOpenChange={setFreqOpen}
        frequency={frequency}
        setFrequency={setFrequency}
        scheduledDays={scheduledDays}
        setScheduledDays={setScheduledDays}
        weeklyTarget={weeklyTarget}
        setWeeklyTarget={setWeeklyTarget}
      />
      <TargetPickerSheet
        open={targetOpen}
        onOpenChange={setTargetOpen}
        frequency={frequency}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        unit={unit}
        setUnit={setUnit}
      />
      <ColorPickerSheet
        open={colorOpen}
        onOpenChange={setColorOpen}
        color={color}
        setColor={setColor}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify copied constants + kit imports**

Read: `packages/features/src/habits/habit-form.tsx` top-of-file — confirm `DAY_OPTIONS` and `COLOR_OPTIONS` values match the copies above; fix any mismatch. Confirm `MediaGlyph`, `MediaPickerSheet`, `NumberInput`, `ToggleGroup` are exported from `@stageholder/ui` (grep the kit `_public`). Confirm `encodeMediaIcon`/`parseMediaIcon` signatures in `./icon-value`.

- [ ] **Step 4: Export from the barrel**

In `packages/features/src/habits/index.ts`, add:

```ts
export { QuickAddHabitSheet } from "./quick-add-habit-sheet.native";
export type { QuickAddHabitSheetProps } from "./quick-add-habit-sheet.native";
```

- [ ] **Step 5: Manual verification (device/simulator)**

Verified via Task 4. Check: name autofocuses; create with name only works (defaults daily/1×/blue/🎯); Frequency picker → weekly reveals day chips, weekly_target reveals count; Target picker count+unit; Color swatch closes on pick; Group pill hidden when no groups; nested picker sheets stack above the create sheet; keyboard returns after icon/pickers.

---

## Task 4: Wire the create dialogs + delete scaffolding

**Files:**

- Modify: `apps/mobile/components/create-todo-dialog.tsx`
- Modify: `apps/mobile/components/create-habit-dialog.tsx`

**Interfaces:**

- Consumes: `QuickAddTodoSheet` (Task 2), `QuickAddHabitSheet` (Task 3).

- [ ] **Step 1: Rewrite `create-todo-dialog.tsx` to render `QuickAddTodoSheet`**

Read the current file first. Keep its mutation + `handleSubmit` + `onOpenChange` logic; replace the `FormSheet` + `Sheet.LazyBody` + `FormSheetSkeleton` + `TodoForm` + epoch key + `mountChildren="open"` block with a single `<QuickAddTodoSheet>`. Map existing props: `lists` → `lookupLists`, `accentColor={IGNITION.todo.base}`, `defaultDoDate` → the existing `defaultDueDate`/seed if present, `isSubmitting={createTodo.isPending}`, `onSubmit={handleSubmit}`. Remove now-unused imports (`FormSheet`, `Sheet`, `FormSheetSkeleton`, `TodoForm`).

Expected shape:

```tsx
return (
  <QuickAddTodoSheet
    open={open}
    onOpenChange={onOpenChange}
    lists={lookupLists}
    defaultDoDate={defaultDueDate ?? undefined}
    accentColor={IGNITION.todo.base}
    isSubmitting={createTodo.isPending}
    onSubmit={handleSubmit}
  />
);
```

- [ ] **Step 2: Rewrite `create-habit-dialog.tsx` to render `QuickAddHabitSheet`**

Same treatment. Map: `groups` → `groupOptions`, `defaultGroupId` → `groupId ?? null`, `accentColor={IGNITION.habit.base}`, `isSubmitting={createHabit.isPending}`, `onSubmit={handleSubmit}`. Delete `FormSheet`/`Sheet.LazyBody`/`FormSheetSkeleton`/`HabitForm`/epoch key/`mountChildren` imports + usage.

```tsx
return (
  <QuickAddHabitSheet
    open={open}
    onOpenChange={onOpenChange}
    groups={groupOptions}
    defaultGroupId={groupId ?? null}
    accentColor={IGNITION.habit.base}
    isSubmitting={createHabit.isPending}
    onSubmit={handleSubmit}
  />
);
```

- [ ] **Step 3: Confirm `FormSheetSkeleton` is still used by the edit dialogs**

Run: `rg -n "FormSheetSkeleton" apps/mobile` — expect hits ONLY in `edit-todo-dialog.tsx`, `edit-habit-dialog.tsx`, and `form-sheet-skeleton.tsx`. If the create dialogs were its only other users, that's fine (file stays for edit). Do NOT delete `form-sheet-skeleton.tsx`.

- [ ] **Step 4: Manual verification (device/simulator) — full pass**

Run the mobile app. From the todos screen `+`: the compact todo quick-add opens, autofocuses, smart-parse fills pills, create works, sheet closes, reopen is clean. From the habits screen `+`: the compact habit quick-add opens, name-only create works, pickers work. Confirm no "sheet stuck raised", no skeleton flash, no scroll on the compact sheets. Then the user runs `bun run build`/tsc for the final type/QA gate.

---

## Self-Review

**Spec coverage:**

- §4 shell → Task 1. §5 Todo sheet (smart input, pills, Note) → Task 2. §6 Habit sheet (icon+name, Frequency/Target/Color/Group/Note pills, nested pickers, defaults) → Task 3. §7 keyboard/nesting (refocus, `inSheet`, nested sheet rules) → Tasks 2–3. §8 files changed → Tasks 1–4. §2 non-goals (edit/PWA/shared forms untouched) → enforced in Global Constraints + Task 4 Step 3. §10 verification → each task's manual step. All covered.

**Placeholder scan:** One deliberate `NOTE (Step 3)` instructs verbatim-copy verification of `DAY_OPTIONS`/`COLOR_OPTIONS` (the values are provided; the note is a correctness check, not a placeholder). No TBD/TODO/"add error handling"/"similar to Task N". Code shown for every code step.

**Type consistency:** `TodoFormValues`/`HabitFormValues` fields match the source forms verbatim. `QuickAddSheetProps.onSubmit` (fires create, no auto-close) is consistent between shell and both sheets. `applyParse` signature matches `SmartParseResult`. `Select ... inSheet` + `Select.Trigger pill width={"auto" as never} minWidth={110}` matches the proven `TodoForm` usage.

**Risks (verify during implementation, per spec §11):**

1. `QuickDatePicker` renders its own pill trigger — confirm `size="sm"` reads as a pill in the row (it does in `TodoForm`). If it needs a custom trigger, wrap per `DateChip`.
2. `FormSheet.HorizontalScroll` + a trailing pinned send `Button` in the same `XStack` — confirm the scroll row shrinks and the button stays pinned (Task 1 Step 2). If layout fights, give the scroll `flex={1}` and the button `shrink={0}`.
3. `Button circular` prop existence (Task 1 Step 2 fallback provided).
4. Nested picker sheets over a `FormSheet` — proven for `MediaPickerSheet`/`Select`; the three custom sheets follow the same `transition="medium"` + `fit` rules.
