import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
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
import { toast } from "sonner";
import { format, addDays, nextMonday } from "date-fns";
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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <View
      position={"fixed" as never}
      t={0}
      b={0}
      l={0}
      r={0}
      z={50}
      items="center"
      justify="center"
    >
      <View
        position={"fixed" as never}
        t={0}
        b={0}
        l={0}
        r={0}
        // load-bearing modal dimming — translucent black, no token equivalent
        bg="rgba(0,0,0,0.5)"
        onPress={() => onOpenChange(false)}
      />
      <YStack
        role="dialog"
        aria-modal="true"
        position="relative"
        z={50}
        mx="$4"
        width="100%"
        maxW={448}
        maxH={"90vh" as never}
        overflowY={"auto" as never}
        rounded="$6"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$4"
        $sm={{ p: "$6" }}
        gap="$4"
        boxShadow="0 16px 48px rgba(0,0,0,0.45)"
      >
        <Text fontSize="$6" fontWeight="600" color="$color">
          New Todo
        </Text>
        <form onSubmit={handleSubmit}>
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
                              <Text color="$primary">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                                </svg>
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
              <YStack>
                <YStack
                  gap="$1.5"
                  $sm={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "$3",
                  }}
                >
                  <Text
                    fontSize="$3"
                    fontWeight="500"
                    color="$color"
                    $sm={{ width: 80, flexShrink: 0 }}
                  >
                    Due Date
                  </Text>
                  <View flex={1}>
                    <DatePicker
                      value={dueDate ? parseDateLocal(dueDate) : null}
                      onChange={(d) =>
                        setDueDate(d ? format(d, "yyyy-MM-dd") : "")
                      }
                      placeholder="No due date"
                      showClear
                    />
                  </View>
                </YStack>
                <XStack mt="$1.5" flexWrap="wrap" gap="$1.5" $sm={{ ml: 92 }}>
                  {[
                    { label: "Today", date: new Date() },
                    { label: "Tomorrow", date: addDays(new Date(), 1) },
                    { label: "Next Week", date: nextMonday(new Date()) },
                  ].map((shortcut) => {
                    const iso = format(shortcut.date, "yyyy-MM-dd");
                    const isActive = dueDate === iso;
                    return (
                      <XStack
                        key={shortcut.label}
                        onPress={() => setDueDate(isActive ? "" : iso)}
                        cursor="pointer"
                        rounded={9999}
                        borderWidth={1}
                        px="$2.5"
                        py="$0.5"
                        transition="quick"
                        borderColor={isActive ? "$primary" : "$borderColor"}
                        bg={isActive ? "$primary" : "transparent"}
                        hoverStyle={isActive ? undefined : { bg: "$accent" }}
                      >
                        <Text
                          fontSize="$1"
                          fontWeight="500"
                          color={
                            isActive ? "$primaryForeground" : "$mutedForeground"
                          }
                        >
                          {shortcut.label}
                        </Text>
                      </XStack>
                    );
                  })}
                </XStack>
              </YStack>

              <YStack>
                <YStack
                  gap="$1.5"
                  $sm={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "$3",
                  }}
                >
                  <Text
                    fontSize="$3"
                    fontWeight="500"
                    color="$color"
                    $sm={{ width: 80, flexShrink: 0 }}
                  >
                    Do Date
                  </Text>
                  <View flex={1}>
                    <DatePicker
                      value={doDate ? parseDateLocal(doDate) : null}
                      onChange={(d) =>
                        setDoDate(d ? format(d, "yyyy-MM-dd") : "")
                      }
                      placeholder="No do date"
                      showClear
                    />
                  </View>
                </YStack>
                <XStack mt="$1.5" flexWrap="wrap" gap="$1.5" $sm={{ ml: 92 }}>
                  {[
                    { label: "Today", date: new Date() },
                    { label: "Tomorrow", date: addDays(new Date(), 1) },
                    { label: "Next Week", date: nextMonday(new Date()) },
                  ].map((shortcut) => {
                    const iso = format(shortcut.date, "yyyy-MM-dd");
                    const isActive = doDate === iso;
                    return (
                      <XStack
                        key={`do-${shortcut.label}`}
                        onPress={() => setDoDate(isActive ? "" : iso)}
                        cursor="pointer"
                        rounded={9999}
                        borderWidth={1}
                        px="$2.5"
                        py="$0.5"
                        transition="quick"
                        borderColor={isActive ? "$primary" : "$borderColor"}
                        bg={isActive ? "$primary" : "transparent"}
                        hoverStyle={isActive ? undefined : { bg: "$accent" }}
                      >
                        <Text
                          fontSize="$1"
                          fontWeight="500"
                          color={
                            isActive ? "$primaryForeground" : "$mutedForeground"
                          }
                        >
                          {shortcut.label}
                        </Text>
                      </XStack>
                    );
                  })}
                </XStack>
              </YStack>
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
      </YStack>
    </View>
  );
}
