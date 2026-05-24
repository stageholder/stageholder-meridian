import { useState, useEffect, type ReactNode } from "react";
import { Inbox, CalendarClock, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import {
  Button,
  DatePicker,
  Dialog,
  Input,
  Label,
  Select,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";

// Priority dot colors — fixed brand swatches matching the shadcn palette
// (blue/yellow/orange/red-500). Decorative per-priority indicators, kept as
// inline hex like the list color dots (no kit token for arbitrary swatches).
const PRIORITY_DOT: Record<string, string> = {
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};

// Shared date field — label + icon header, then the kit DatePicker with its
// built-in Notion-style preset shortcuts. Used for both Due and Do dates.
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
        value={value ? parseDateLocal(value) : null}
        onChange={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
        placeholder={`No ${label.toLowerCase()}`}
        presets={["today", "tomorrow", "next-week"]}
        headerStyle="compact"
        showClear
      />
    </YStack>
  );
}

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId?: string;
  defaultDueDate?: string;
}

export function CreateTodoDialog({
  open,
  onOpenChange,
  listId,
  defaultDueDate,
}: CreateTodoDialogProps) {
  const [selectedListId, setSelectedListId] = useState(listId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState(defaultDueDate || "");
  const [doDate, setDoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();

  const defaultListId =
    lists?.find((l) => l.isDefault)?.id || lists?.[0]?.id || "";

  useEffect(() => {
    if (open) {
      setSelectedListId(listId || defaultListId);
      if (defaultDueDate) setDueDate(defaultDueDate);
    }
  }, [open, listId, defaultDueDate, defaultListId]);

  // Ensure selectedListId is always valid when lists are loaded
  useEffect(() => {
    if (open && !selectedListId && defaultListId) {
      setSelectedListId(defaultListId);
    }
  }, [open, selectedListId, defaultListId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    createTodo.mutate(
      {
        listId: selectedListId || defaultListId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          doDate: doDate || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Todo created");
          setTitle("");
          setDescription("");
          setPriority("none");
          setDueDate("");
          setDoDate(format(new Date(), "yyyy-MM-dd"));
          onOpenChange(false);
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          width="90%"
          maxW={448}
          maxH={"86vh" as never}
          overflow={"auto" as never}
          onPointerDownOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
        >
          <Dialog.Title>New Todo</Dialog.Title>
          <Dialog.Description>
            Create a new todo with optional details, priority, and dates.
          </Dialog.Description>
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
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
                                  style={{
                                    backgroundColor: list.color || "#6b7280",
                                  }}
                                />
                              )}
                            </XStack>
                            {/* Kit's Select.Item only auto-wraps string/number
                              children in ItemText. For JSX children (icon
                              + label), include ItemText explicitly so the
                              trigger's value-display still shows the list
                              name when this option is selected. */}
                            <Select.ItemText>{list.name}</Select.ItemText>
                          </XStack>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </YStack>
              )}

              <YStack gap="$1">
                <Label htmlFor="todo-title">Title</Label>
                <Input
                  id="todo-title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </YStack>

              <YStack gap="$1">
                <Label htmlFor="todo-description">Description</Label>
                <TextArea
                  id="todo-description"
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
                    <Select.Item value="low">
                      <XStack items="center" gap="$2">
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: PRIORITY_DOT.low }}
                        />
                        <Select.ItemText>Low</Select.ItemText>
                      </XStack>
                    </Select.Item>
                    <Select.Item value="medium">
                      <XStack items="center" gap="$2">
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: PRIORITY_DOT.medium }}
                        />
                        <Select.ItemText>Medium</Select.ItemText>
                      </XStack>
                    </Select.Item>
                    <Select.Item value="high">
                      <XStack items="center" gap="$2">
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: PRIORITY_DOT.high }}
                        />
                        <Select.ItemText>High</Select.ItemText>
                      </XStack>
                    </Select.Item>
                    <Select.Item value="urgent">
                      <XStack items="center" gap="$2">
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: PRIORITY_DOT.urgent }}
                        />
                        <Select.ItemText>Urgent</Select.ItemText>
                      </XStack>
                    </Select.Item>
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
                <Button
                  intent="outline"
                  type="button"
                  onPress={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!title.trim() || createTodo.isPending}
                  loading={createTodo.isPending}
                  loadingText="Creating…"
                >
                  Create
                </Button>
              </XStack>
            </YStack>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
