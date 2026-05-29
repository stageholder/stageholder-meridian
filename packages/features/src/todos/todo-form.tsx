import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { Inbox, CalendarClock, Clock } from "lucide-react";
import { Form } from "tamagui";
import {
  Button,
  DatePicker,
  Input,
  Label,
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
 * Shared date field — label + icon header, then the kit DatePicker with
 * its built-in Notion-style preset shortcuts. Used for both Due and Do
 * dates. Cross-platform — kit DatePicker handles its own native vs web
 * presentation.
 */
function DateField({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <YStack gap="$1.5">
      <XStack items="center" gap="$2">
        <Text color="$mutedForeground" lineHeight={0}>
          {icon}
        </Text>
        <Text fontSize="$3" fontWeight="500" color="$color">
          {label}
        </Text>
      </XStack>
      <DatePicker
        value={value ? parseLocalDay(value) : null}
        onChange={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
        placeholder={`No ${label.toLowerCase()}`}
        presets={["today", "tomorrow", "next-week"]}
        headerStyle="compact"
        showClear
      />
    </YStack>
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
  onSubmit,
  onCancel,
}: TodoFormProps) {
  const defaultListId =
    lists?.find((l) => l.isDefault)?.id || lists?.[0]?.id || "";
  const [selectedListId, setSelectedListId] = useState(
    initial.listId || defaultListId,
  );
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [priority, setPriority] = useState(initial.priority);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [doDate, setDoDate] = useState(initial.doDate ?? "");

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
        {lists && lists.length > 1 && (
          <YStack gap="$1">
            <Text fontSize="$3" fontWeight="500" color="$color">
              List
            </Text>
            <Select
              value={selectedListId || defaultListId}
              onValueChange={setSelectedListId}
            >
              <Select.Trigger placeholder="Select list" width="100%" />
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
                          <Text color="$primary" lineHeight={0}>
                            <Inbox size={12} />
                          </Text>
                        ) : (
                          <View
                            width={8}
                            height={8}
                            rounded={9999}
                            style={{ backgroundColor: list.color || "#6b7280" }}
                          />
                        )}
                      </XStack>
                      {/* Kit Select.Item only auto-wraps string/number children
                          in ItemText. For JSX children, include ItemText
                          explicitly so the trigger's value-display still shows
                          the list name when this option is selected. */}
                      <Select.ItemText>{list.name}</Select.ItemText>
                    </XStack>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </YStack>
        )}

        <YStack gap="$1">
          <Label htmlFor="todo-form-title">Title</Label>
          <Input
            id="todo-form-title"
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            autoFocus
          />
        </YStack>

        <YStack gap="$1">
          <Label htmlFor="todo-form-description">Description</Label>
          <TextArea
            id="todo-form-description"
            value={description}
            onChangeText={setDescription}
            placeholder="Add details..."
            rows={3}
          />
        </YStack>

        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="500" color="$color">
            Priority
          </Text>
          <Select value={priority} onValueChange={setPriority}>
            <Select.Trigger placeholder="None" width="100%" />
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
        </YStack>

        <YStack gap="$3">
          <DateField
            label="Due Date"
            icon={<CalendarClock size={14} />}
            value={dueDate}
            onChange={setDueDate}
          />
          <DateField
            label="Do Date"
            icon={<Clock size={14} />}
            value={doDate}
            onChange={setDoDate}
          />
        </YStack>

        <XStack justify="flex-end" gap="$3" pt="$2">
          <Button intent="outline" type="button" onPress={onCancel}>
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
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
    priority: "none",
    dueDate: "",
    doDate: format(new Date(), "yyyy-MM-dd"),
    listId: undefined,
  };
}
