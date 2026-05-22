import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import {
  Button,
  Calendar,
  Input,
  Popover,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { toast } from "sonner";
import { format, addDays, nextMonday } from "date-fns";
import { parseDateLocal } from "@/lib/date";

interface QuickAddTodoProps {
  listId: string;
}

// Priority dot swatches — fixed brand hex (blue/yellow/orange/red-500),
// decorative per-priority indicators with no kit token equivalent.
const PRIORITIES = [
  { value: "none", label: "None", color: null },
  { value: "low", label: "Low", color: "#3b82f6" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "urgent", label: "Urgent", color: "#ef4444" },
] as const;

// Priority badge intent tokens — urgent→destructive, high/medium→warning,
// low→primary (azure). Mirrors todo-item.tsx.
const PRIORITY_BADGE: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
};

function getToday() {
  return format(new Date(), "yyyy-MM-dd");
}

export function QuickAddTodo({ listId }: QuickAddTodoProps) {
  const [title, setTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);
  const [doDate, setDoDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("none");
  const [selectedListId, setSelectedListId] = useState(listId);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();

  // Sync selectedListId when listId prop changes (e.g., lists finish loading)
  useEffect(() => {
    if (listId && !selectedListId) {
      setSelectedListId(listId);
    }
  }, [listId, selectedListId]);

  function resetForm() {
    setTitle("");
    setDoDate("");
    setDueDate("");
    setPriority("none");
    setSelectedListId(listId);
  }

  function handleCancel() {
    setIsEditing(false);
    resetForm();
  }

  const handleSubmit = useCallback(() => {
    if (!title.trim() || createTodo.isPending) return;

    createTodo.mutate(
      {
        listId: selectedListId,
        data: {
          title: title.trim(),
          priority: priority !== "none" ? priority : undefined,
          doDate: doDate || undefined,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          setDoDate(getToday());
          setIsEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, selectedListId, priority, doDate, dueDate, createTodo.isPending]);

  const [justActivated, setJustActivated] = useState(false);

  function handleActivate() {
    setIsEditing(true);
    setShowFullDialog(false);
    setSelectedListId(listId);
    setDoDate(getToday());
    setJustActivated(true);
    setTimeout(() => {
      inputRef.current?.focus();
      setJustActivated(false);
    }, 100);
  }

  // Close on Escape
  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Listen for global "N" shortcut event (quick add focus)
  const handleActivateRef = useRef(handleActivate);
  handleActivateRef.current = handleActivate;
  useEffect(() => {
    function onQuickAdd() {
      handleActivateRef.current();
    }
    window.addEventListener("meridian:quick-add-todo", onQuickAdd);
    return () => {
      window.removeEventListener("meridian:quick-add-todo", onQuickAdd);
    };
  }, []);

  const selectedList = lists?.find((l) => l.id === selectedListId);

  const doDateInfo = doDate
    ? (() => {
        const today = getToday();
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
        if (doDate < today)
          return {
            label: format(parseDateLocal(doDate), "MMM d"),
            color: "$destructive",
          };
        if (doDate === today)
          return {
            label: "Today",
            color: "$success",
          };
        if (doDate === tomorrow)
          return {
            label: "Tomorrow",
            color: "$warning",
          };
        return {
          label: format(parseDateLocal(doDate), "MMM d"),
          color: "$info",
        };
      })()
    : null;

  const formattedDueDate = dueDate
    ? (() => {
        const today = getToday();
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
        if (dueDate === today) return "Today";
        if (dueDate === tomorrow) return "Tomorrow";
        return format(parseDateLocal(dueDate), "MMM d");
      })()
    : null;

  if (!isEditing) {
    return (
      <XStack
        onPress={handleActivate}
        cursor="pointer"
        width="100%"
        items="center"
        gap="$2"
        rounded="$lg"
        borderWidth={1}
        borderStyle="dashed"
        borderColor="$borderColor"
        px="$3"
        py="$2"
        color="$mutedForeground"
        transition="quick"
        hoverStyle={{ borderColor: "$primary", color: "$color" }}
        role="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        <Text fontSize="$3">Add a todo...</Text>
      </XStack>
    );
  }

  return (
    <>
      <View
        rounded="$lg"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        px="$4"
        py="$3"
      >
        <XStack items="flex-start" gap="$3">
          {/* Checkbox placeholder */}
          <View
            mt="$0.5"
            width={20}
            height={20}
            shrink={0}
            rounded={9999}
            borderWidth={2}
            borderColor="$mutedForeground"
          />

          <YStack flex={1} minW={0}>
            {/* Title input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <Input
                ref={inputRef}
                value={title}
                onChangeText={setTitle}
                placeholder="Todo title..."
                unstyled
                width="100%"
                bg="transparent"
                fontSize="$3"
                fontWeight="500"
                color="$color"
                placeholderTextColor="$mutedForeground"
                focusVisibleStyle={{ outlineWidth: 0 }}
              />
            </form>

            {/* Metadata chips row — same style as TodoItem */}
            <XStack mt="$1.5" flexWrap="wrap" items="center" gap="$2">
              {/* Priority */}
              <Popover placement="bottom-start">
                <Popover.Trigger asChild>
                  <XStack cursor="pointer" items="center" gap="$1">
                    {PRIORITY_BADGE[priority] ? (
                      <Text
                        bg={PRIORITY_BADGE[priority].bg}
                        color={PRIORITY_BADGE[priority].color}
                        rounded={9999}
                        px="$2"
                        py="$0.5"
                        fontSize="$1"
                        fontWeight="500"
                      >
                        {PRIORITY_BADGE[priority].label}
                      </Text>
                    ) : (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded={9999}
                        borderWidth={1}
                        borderStyle="dashed"
                        borderColor="$borderColor"
                        px="$2"
                        py="$0.5"
                        color="$mutedForeground"
                        hoverStyle={{ borderColor: "$mutedForeground" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                        <Text fontSize="$1" color="$mutedForeground">
                          Priority
                        </Text>
                      </XStack>
                    )}
                  </XStack>
                </Popover.Trigger>
                <Popover.Content width={144} p="$1">
                  {PRIORITIES.map((p) => (
                    <XStack
                      key={p.value}
                      onPress={() => setPriority(p.value)}
                      cursor="pointer"
                      width="100%"
                      items="center"
                      gap="$2"
                      rounded="$sm"
                      px="$2"
                      py="$1.5"
                      transition="quick"
                      bg={priority === p.value ? "$accent" : "transparent"}
                      hoverStyle={{ bg: "$accent" }}
                    >
                      {p.color ? (
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{ backgroundColor: p.color }}
                        />
                      ) : (
                        <View width={8} height={8} />
                      )}
                      <Text
                        fontSize="$1"
                        fontWeight={priority === p.value ? "500" : "400"}
                        color="$color"
                      >
                        {p.label}
                      </Text>
                    </XStack>
                  ))}
                </Popover.Content>
              </Popover>

              {/* Do Date */}
              <Popover placement="bottom-start">
                <Popover.Trigger asChild>
                  <XStack cursor="pointer" items="center" gap="$1">
                    {doDateInfo ? (
                      <XStack items="center" gap="$1" color={doDateInfo.color}>
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
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <Text fontSize="$1" color={doDateInfo.color}>
                          {doDateInfo.label}
                        </Text>
                      </XStack>
                    ) : (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded={9999}
                        borderWidth={1}
                        borderStyle="dashed"
                        borderColor="$borderColor"
                        px="$2"
                        py="$0.5"
                        color="$mutedForeground"
                        hoverStyle={{ borderColor: "$mutedForeground" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <Text fontSize="$1" color="$mutedForeground">
                          Do date
                        </Text>
                      </XStack>
                    )}
                  </XStack>
                </Popover.Trigger>
                <Popover.Content width="auto">
                  <XStack flexWrap="wrap" gap="$1" pb="$2">
                    {[
                      { label: "Today", date: new Date() },
                      { label: "Tomorrow", date: addDays(new Date(), 1) },
                      { label: "Next Week", date: nextMonday(new Date()) },
                    ].map((shortcut) => {
                      const iso = format(shortcut.date, "yyyy-MM-dd");
                      const isActive = doDate === iso;
                      return (
                        <XStack
                          key={shortcut.label}
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
                              isActive
                                ? "$primaryForeground"
                                : "$mutedForeground"
                            }
                          >
                            {shortcut.label}
                          </Text>
                        </XStack>
                      );
                    })}
                    {doDate && (
                      <XStack
                        onPress={() => setDoDate("")}
                        cursor="pointer"
                        rounded={9999}
                        borderWidth={1}
                        borderColor="$borderColor"
                        px="$2.5"
                        py="$0.5"
                        hoverStyle={{ bg: "$accent" }}
                      >
                        <Text
                          fontSize="$1"
                          fontWeight="500"
                          color="$mutedForeground"
                        >
                          Clear
                        </Text>
                      </XStack>
                    )}
                  </XStack>
                  <Calendar
                    mode="single"
                    value={doDate ? parseDateLocal(doDate) : null}
                    onChange={(date) =>
                      setDoDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    initialMonth={doDate ? parseDateLocal(doDate) : undefined}
                  />
                </Popover.Content>
              </Popover>

              {/* Due Date */}
              <Popover placement="bottom-start">
                <Popover.Trigger asChild>
                  <XStack cursor="pointer" items="center" gap="$1">
                    {formattedDueDate ? (
                      <XStack
                        items="center"
                        gap="$1"
                        color={
                          dueDate && dueDate < getToday()
                            ? "$destructive"
                            : "$mutedForeground"
                        }
                      >
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
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        <Text
                          fontSize="$1"
                          color={
                            dueDate && dueDate < getToday()
                              ? "$destructive"
                              : "$mutedForeground"
                          }
                        >
                          {formattedDueDate}
                        </Text>
                      </XStack>
                    ) : (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded={9999}
                        borderWidth={1}
                        borderStyle="dashed"
                        borderColor="$borderColor"
                        px="$2"
                        py="$0.5"
                        color="$mutedForeground"
                        hoverStyle={{ borderColor: "$mutedForeground" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        <Text fontSize="$1" color="$mutedForeground">
                          Due date
                        </Text>
                      </XStack>
                    )}
                  </XStack>
                </Popover.Trigger>
                <Popover.Content width="auto">
                  <XStack flexWrap="wrap" gap="$1" pb="$2">
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
                              isActive
                                ? "$primaryForeground"
                                : "$mutedForeground"
                            }
                          >
                            {shortcut.label}
                          </Text>
                        </XStack>
                      );
                    })}
                    {dueDate && (
                      <XStack
                        onPress={() => setDueDate("")}
                        cursor="pointer"
                        rounded={9999}
                        borderWidth={1}
                        borderColor="$borderColor"
                        px="$2.5"
                        py="$0.5"
                        hoverStyle={{ bg: "$accent" }}
                      >
                        <Text
                          fontSize="$1"
                          fontWeight="500"
                          color="$mutedForeground"
                        >
                          Clear
                        </Text>
                      </XStack>
                    )}
                  </XStack>
                  <Calendar
                    mode="single"
                    value={dueDate ? parseDateLocal(dueDate) : null}
                    onChange={(date) =>
                      setDueDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    initialMonth={dueDate ? parseDateLocal(dueDate) : undefined}
                  />
                </Popover.Content>
              </Popover>

              {/* List selector */}
              {lists && lists.length > 1 && (
                <Popover placement="bottom-start">
                  <Popover.Trigger asChild>
                    <XStack
                      cursor="pointer"
                      items="center"
                      gap="$1"
                      rounded={9999}
                      borderWidth={1}
                      borderStyle="dashed"
                      borderColor="$borderColor"
                      px="$2"
                      py="$0.5"
                      color="$mutedForeground"
                      hoverStyle={{
                        borderColor: "$mutedForeground",
                        color: "$color",
                      }}
                    >
                      {selectedList && !selectedList.isDefault ? (
                        <View
                          width={8}
                          height={8}
                          rounded={9999}
                          style={{
                            backgroundColor: selectedList.color || "#6b7280",
                          }}
                        />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="8" x2="21" y1="6" y2="6" />
                          <line x1="8" x2="21" y1="12" y2="12" />
                          <line x1="8" x2="21" y1="18" y2="18" />
                          <line x1="3" x2="3.01" y1="6" y2="6" />
                          <line x1="3" x2="3.01" y1="12" y2="12" />
                          <line x1="3" x2="3.01" y1="18" y2="18" />
                        </svg>
                      )}
                      <Text fontSize="$1">{selectedList?.name || "List"}</Text>
                    </XStack>
                  </Popover.Trigger>
                  <Popover.Content width={176} p="$1">
                    {lists.map((list) => (
                      <XStack
                        key={list.id}
                        onPress={() => setSelectedListId(list.id)}
                        cursor="pointer"
                        width="100%"
                        items="center"
                        gap="$2"
                        rounded="$sm"
                        px="$2"
                        py="$1.5"
                        transition="quick"
                        bg={
                          selectedListId === list.id ? "$accent" : "transparent"
                        }
                        hoverStyle={{ bg: "$accent" }}
                      >
                        {list.isDefault ? (
                          <Text color="$primary">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
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
                        <Text
                          fontSize="$1"
                          fontWeight={
                            selectedListId === list.id ? "500" : "400"
                          }
                          color="$color"
                        >
                          {list.name}
                        </Text>
                      </XStack>
                    ))}
                  </Popover.Content>
                </Popover>
              )}
            </XStack>
          </YStack>

          {/* Action buttons */}
          <XStack shrink={0} items="center" gap="$1">
            <XStack
              onPress={() => {
                if (!justActivated) setShowFullDialog(true);
              }}
              cursor="pointer"
              items="center"
              gap="$1"
              rounded="$md"
              px="$2"
              py="$1"
              color="$mutedForeground"
              hoverStyle={{ bg: "$accent", color: "$color" }}
              title="Open full editor"
            >
              <Pencil size={12} />
              <Text fontSize="$1">More</Text>
            </XStack>
            <Button
              intent="ghost"
              size="sm"
              type="button"
              onPress={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              onPress={handleSubmit}
              disabled={!title.trim() || createTodo.isPending}
              loading={createTodo.isPending}
              loadingText="Adding…"
            >
              Add
            </Button>
          </XStack>
        </XStack>
      </View>

      <CreateTodoDialog
        open={showFullDialog}
        onOpenChange={setShowFullDialog}
        listId={selectedListId}
      />
    </>
  );
}
