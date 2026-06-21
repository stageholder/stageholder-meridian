import { useId, useState } from "react";
import { format } from "date-fns";
import { Inbox } from "@tamagui/lucide-icons-2";
import { Form, isWeb } from "tamagui";
import {
  Button,
  Input,
  Label,
  QuickDatePicker,
  Select,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/** Priority dot colors — fixed brand swatches matching the shadcn palette. */
const PRIORITY_DOT: Record<string, string> = {
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};

/** Cross-platform shape of the create/edit-todo form values. */
export interface TodoFormValues {
  title: string;
  description?: string;
  priority: string;
  /** `yyyy-MM-dd` local-day string, or empty for "no date". */
  dueDate?: string;
  /** `yyyy-MM-dd` local-day string, or empty for "no date". */
  doDate?: string;
  /** Selected list id (or undefined when the List field is hidden). */
  listId?: string;
}

/** Minimal list shape needed to render the List select. */
export interface TodoListChoice {
  id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface TodoFormProps {
  /** Initial values to seed the form with. */
  initial: TodoFormValues;
  /**
   * Available lists. When `undefined` or length ≤ 1 the List field is
   * hidden (single-list users / pages already scoped to a list).
   */
  lists?: TodoListChoice[];
  submitLabel: string;
  submittingLabel: string;
  isSubmitting?: boolean;
  /**
   * Accent color for the submit button — Meridian's todo category color
   * (red). Defaults to the web CSS var `var(--ring-todo)`; native callers
   * MUST pass a resolved hex (e.g. the mobile `IGNITION.todo.base`) since
   * react-native can't resolve `var(...)`. Mirrors `HabitForm.accentColor`.
   */
  accentColor?: string;
  onSubmit: (values: TodoFormValues) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Parse a `yyyy-MM-dd` string as the LOCAL day. The DatePicker speaks
 * `Date` objects, the API speaks ISO date strings — this is the bridge.
 */
function parseLocalDay(input: string): Date {
  return new Date(input + "T00:00:00");
}

/**
 * Compact date CHIP — just the kit QuickDatePicker pill at `size="sm"`,
 * no header label. The pill self-describes via its short placeholder ("Do"
 * / "Due") when empty and the resolved smart label ("Today", "Sat") when
 * set, plus the QDP's leading calendar icon. Sits inline in the field
 * chip row. Cross-platform — QDP owns its native (sheet) vs web (popover)
 * presentation.
 */
function DateChip({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <QuickDatePicker
      size="sm"
      value={value ? parseLocalDay(value) : null}
      onChange={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
      placeholder={placeholder}
    />
  );
}

/**
 * Cross-platform create/edit todo form — shared by the PWA's create-todo
 * dialog (and the future mobile equivalent). Pure presentational +
 * controlled fields; the host owns the surrounding chrome (Dialog,
 * Sheet, full-screen page) and the create/update mutation. Follows the
 * `HabitForm` / `TodoListForm` template: re-mount via `key` for reset.
 */
export function TodoForm({
  initial,
  lists,
  submitLabel,
  submittingLabel,
  isSubmitting,
  accentColor = "var(--ring-todo)",
  onSubmit,
  onCancel,
}: TodoFormProps) {
  const defaultListId =
    lists?.find((l) => l.isDefault)?.id || lists?.[0]?.id || "";
  const [selectedListId, setSelectedListId] = useState(
    initial.listId || defaultListId,
  );
  // Several TodoForm instances can be MOUNTED at once (create + edit sheets
  // on the todos screen, the calendar's create dialog — tab screens stay
  // alive), so input ids must be per-instance or RN warns "duplicate ID for
  // input". useId keeps the Label↔Input pairing collision-free.
  const uid = useId();
  const titleId = `todo-form-title-${uid}`;
  const descriptionId = `todo-form-description-${uid}`;

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [priority, setPriority] = useState(initial.priority);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [doDate, setDoDate] = useState(initial.doDate ?? "");

  // List chip is only offered when the host gives >1 list (single-list users
  // and list-scoped pages pass a filtered single-list array). `selectedList`
  // drives the chip face (Inbox icon for the default list, color dot else).
  const showListChip = !!lists && lists.length > 1;
  const activeListId = selectedListId || defaultListId;
  const selectedList = lists?.find((l) => l.id === activeListId);

  function handleSubmit() {
    if (!title.trim()) return;
    void onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      doDate: doDate || undefined,
      listId: selectedListId || defaultListId || undefined,
    });
  }

  return (
    <Form onSubmit={handleSubmit} width="100%">
      <YStack gap="$4">
        <YStack gap="$1">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            autoFocus
          />
        </YStack>

        <YStack gap="$1">
          <Label htmlFor={descriptionId}>Description</Label>
          <TextArea
            id={descriptionId}
            value={description}
            onChangeText={setDescription}
            placeholder="Add details..."
            rows={3}
            // See habit-form: Tamagui's `rows × lineHeight` height ignores the
            // textarea's padding under border-box, leaving a permanent
            // scrollbar. `height="auto"` lets the native `rows` size it.
            height={"auto" as never}
          />
        </YStack>

        {/* Compact chip row — Priority + the two dates as small pills, no
            header labels: each chip self-describes (Priority shows its
            colored dot + level or "Priority" when none; the date chips show
            their calendar icon + "Do"/"Due" placeholder or the smart date
            label). `flexWrap` lets a chip drop to a second line on the
            narrowest sheets. Order: List · Priority · Do · Due. */}
        <XStack gap="$2" flexWrap="wrap" items="center">
          {/* List chip — only when the user has >1 list to choose between
              (single-list users / list-scoped pages get `lists` filtered to
              one by the host, so the chip is hidden and the destination is
              implicit). Defaults to the Inbox / default list. Same pill
              treatment as the Priority chip; the face shows the Inbox icon
              for the default list or the list's color dot otherwise. */}
          {showListChip && lists ? (
            <Select
              size="sm"
              value={activeListId}
              onValueChange={setSelectedListId}
              // Native FormSheet rationale: force the driven-sheet listbox
              // (kit ancestor-Adapt auto-detection misses inside a Sheet and
              // the Select's own Adapt path crashes on RN).
              inSheet={isWeb ? undefined : true}
            >
              <Select.Trigger pill width={"auto" as never} minW={0}>
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
                      <XStack
                        width={12}
                        height={12}
                        shrink={0}
                        items="center"
                        justify="center"
                      >
                        {list.isDefault ? (
                          // lucide-icons-2 reads its own `color`.
                          <Inbox size={12} color="$primary" />
                        ) : (
                          <View
                            width={8}
                            height={8}
                            rounded={9999}
                            style={{
                              backgroundColor: list.color || "#6b7280",
                            }}
                          />
                        )}
                      </XStack>
                      {/* JSX child → include ItemText so the selected value
                          still renders the list name. */}
                      <Select.ItemText>{list.name}</Select.ItemText>
                    </XStack>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          ) : null}

          {/* inSheet: same FormSheet rationale as the List select above.
              `size="sm"` matches the QDP date chips. `pill` = the kit's
              fully-rounded shape; `width="auto"` is REQUIRED to cancel the
              trigger's inherited `@tamagui/list-item` `width:100%` (the kit
              only auto-sizes it for `iconOnly`) — without it the trigger
              fills the row and pushes the date chips onto a second line.
              Custom children render the chip face so an empty priority reads
              "Priority", not "None". */}
          <Select
            size="sm"
            value={priority}
            onValueChange={setPriority}
            inSheet={isWeb ? undefined : true}
          >
            <Select.Trigger pill width={"auto" as never} minW={0}>
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

          <DateChip placeholder="Do" value={doDate} onChange={setDoDate} />
          <DateChip placeholder="Due" value={dueDate} onChange={setDueDate} />
        </XStack>

        {/* Full-width 50/50 lg buttons on mobile (the bottom sheet);
            right-aligned, content-width on DESKTOP. `$md` is min-width
            768 in @tamagui/config v5 (mobile-first), so it only matches the
            desktop dialog. */}
        <XStack gap="$3" pt="$2" $md={{ justify: "flex-end" }}>
          <Button
            intent="outline"
            type="button"
            size="lg"
            flex={1}
            $md={{ flexBasis: "auto", grow: 0 }}
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
              size="lg"
              flex={1}
              $md={{ flexBasis: "auto", grow: 0 }}
              // Todo category color (red) — same accent treatment as
              // HabitForm's submit. White label on the colored fill; the
              // free-form hex/var rides the style hatch (no kit token).
              borderWidth={0}
              color={"#ffffff" as never}
              style={{ backgroundColor: accentColor }}
              hoverStyle={
                { backgroundColor: accentColor, opacity: 0.9 } as never
              }
              pressStyle={
                { backgroundColor: accentColor, opacity: 0.82 } as never
              }
              disabled={!title.trim() || isSubmitting}
              loading={isSubmitting}
              loadingText={submittingLabel}
            >
              {submitLabel}
            </Button>
          </Form.Trigger>
        </XStack>
      </YStack>
    </Form>
  );
}

/** Defaults for the create-todo flow (do-date pre-fills to today). */
export function makeTodoFormDefaults(): TodoFormValues {
  return {
    title: "",
    description: "",
    // Default to "low" so a new todo always carries a concrete priority
    // (the pill shows its colored dot from the start) rather than "none".
    priority: "low",
    dueDate: "",
    doDate: format(new Date(), "yyyy-MM-dd"),
    listId: undefined,
  };
}
