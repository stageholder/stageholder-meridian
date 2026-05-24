import { useRef, useState, useEffect, useCallback } from "react";
import { Plus, Maximize2, Flag, Inbox, List } from "lucide-react";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import {
  Button,
  DatePicker,
  Input,
  Popover,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import type { TodoList } from "@repo/core/types";

interface QuickAddTodoProps {
  listId: string;
}

// Priority swatch (decorative hex dot) + the selected-state badge tokens
// (urgent→destructive, high/medium→warning, low→primary — mirrors todo-item).
const PRIORITIES = [
  { value: "none", label: "None", color: null },
  { value: "low", label: "Low", color: "#3b82f6" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "urgent", label: "Urgent", color: "#ef4444" },
] as const;

const PRIORITY_BADGE: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
};

// Quick-pick shortcuts wired into the kit DatePicker's preset strip.
const DATE_PRESETS = ["today", "tomorrow", "next-week"] as const;

function getToday() {
  return format(new Date(), "yyyy-MM-dd");
}

// Bridges the ISO-string state to the kit DatePicker's Date | null contract.
function isoToDate(value: string): Date | null {
  return value ? parseDateLocal(value) : null;
}
function dateToIso(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

// Priority trigger pill + popover.
function PriorityChip({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const badge = PRIORITY_BADGE[value];
  return (
    <Popover placement="bottom-start">
      <Popover.Trigger asChild>
        <XStack cursor="pointer" items="center">
          {badge ? (
            <Text
              bg={badge.bg}
              color={badge.color}
              rounded={9999}
              px="$2"
              py="$1"
              fontSize="$1"
              fontWeight="500"
            >
              {badge.label}
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
              py="$1"
              transition="quick"
              hoverStyle={{ borderColor: "$mutedForeground" }}
            >
              <Text color="$mutedForeground" lineHeight={0}>
                <Flag size={11} />
              </Text>
              <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                Priority
              </Text>
            </XStack>
          )}
        </XStack>
      </Popover.Trigger>
      <Popover.Content width={168} p="$1">
        {PRIORITIES.map((p) => (
          <XStack
            key={p.value}
            onPress={() => onChange(p.value)}
            cursor="pointer"
            items="center"
            gap="$2"
            rounded="$sm"
            px="$2"
            py="$1.5"
            transition="quick"
            bg={value === p.value ? "$accent" : "transparent"}
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
              fontWeight={value === p.value ? "500" : "400"}
              color="$color"
            >
              {p.label}
            </Text>
          </XStack>
        ))}
      </Popover.Content>
    </Popover>
  );
}

// List trigger pill + popover (only rendered when there's more than one list).
function ListChip({
  lists,
  value,
  onChange,
}: {
  lists: TodoList[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = lists.find((l) => l.id === value);
  return (
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
          py="$1"
          transition="quick"
          hoverStyle={{ borderColor: "$mutedForeground" }}
        >
          {selected && !selected.isDefault ? (
            <View
              width={8}
              height={8}
              rounded={9999}
              style={{ backgroundColor: selected.color || "#6b7280" }}
            />
          ) : (
            <Text color="$mutedForeground" lineHeight={0}>
              <List size={11} />
            </Text>
          )}
          <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
            {selected?.name || "List"}
          </Text>
        </XStack>
      </Popover.Trigger>
      <Popover.Content width={184} p="$1">
        {lists.map((list) => (
          <XStack
            key={list.id}
            onPress={() => onChange(list.id)}
            cursor="pointer"
            items="center"
            gap="$2"
            rounded="$sm"
            px="$2"
            py="$1.5"
            transition="quick"
            bg={value === list.id ? "$accent" : "transparent"}
            hoverStyle={{ bg: "$accent" }}
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
            <Text
              fontSize="$1"
              fontWeight={value === list.id ? "500" : "400"}
              color="$color"
            >
              {list.name}
            </Text>
          </XStack>
        ))}
      </Popover.Content>
    </Popover>
  );
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

  useEffect(() => {
    if (listId && !selectedListId) setSelectedListId(listId);
  }, [listId, selectedListId]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDoDate("");
    setDueDate("");
    setPriority("none");
    setSelectedListId(listId);
  }, [listId]);

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
          // Keep the composer open and refocused for rapid entry.
          resetForm();
          setDoDate(getToday());
          setTimeout(() => inputRef.current?.focus(), 0);
        },
        onError: () => toast.error("Failed to create todo"),
      },
    );
  }, [title, selectedListId, priority, doDate, dueDate, createTodo, resetForm]);

  const handleActivate = useCallback(() => {
    setIsEditing(true);
    setSelectedListId(listId);
    setDoDate(getToday());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [listId]);

  // Escape closes the composer.
  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Global "quick add" shortcut (dispatched elsewhere as a window event).
  const activateRef = useRef(handleActivate);
  activateRef.current = handleActivate;
  useEffect(() => {
    const onQuickAdd = () => activateRef.current();
    window.addEventListener("meridian:quick-add-todo", onQuickAdd);
    return () =>
      window.removeEventListener("meridian:quick-add-todo", onQuickAdd);
  }, []);

  if (!isEditing) {
    return (
      <XStack
        group
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
        py="$2.5"
        transition="quick"
        hoverStyle={{ borderColor: "$primary" }}
        role="button"
      >
        <Text
          color="$mutedForeground"
          lineHeight={0}
          $group-hover={{ color: "$color" }}
        >
          <Plus size={16} />
        </Text>
        <Text
          fontSize="$3"
          color="$mutedForeground"
          $group-hover={{ color: "$color" }}
        >
          Add a todo…
        </Text>
      </XStack>
    );
  }

  return (
    <>
      <YStack
        rounded="$lg"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$3"
        gap="$3"
      >
        {/* Title */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ width: "100%" }}
        >
          <Input
            ref={inputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Todo title…"
            unstyled
            width="100%"
            px="$2"
            bg="transparent"
            fontSize="$3"
            fontWeight="500"
            color="$color"
            placeholderTextColor="$mutedForeground"
            focusVisibleStyle={{ outlineWidth: 0 }}
          />
        </form>

        {/* Metadata — priority pill + kit date pickers (Notion-style, with
            preset shortcuts) + list pill. */}
        <XStack flexWrap="wrap" items="center" gap="$2">
          <PriorityChip value={priority} onChange={setPriority} />
          <DatePicker
            value={isoToDate(doDate)}
            onChange={(d) => setDoDate(dateToIso(d))}
            placeholder="Do date"
            presets={[...DATE_PRESETS]}
            headerStyle="compact"
            showClear
          />
          <DatePicker
            value={isoToDate(dueDate)}
            onChange={(d) => setDueDate(dateToIso(d))}
            placeholder="Due date"
            presets={[...DATE_PRESETS]}
            headerStyle="compact"
            showClear
          />
          {lists && lists.length > 1 ? (
            <ListChip
              lists={lists}
              value={selectedListId}
              onChange={setSelectedListId}
            />
          ) : null}
        </XStack>

        {/* Footer — [Add Todo] [More] … [Cancel] */}
        <XStack items="center" justify="space-between">
          <XStack items="center" gap="$2">
            <Button
              size="sm"
              type="button"
              borderWidth={0}
              color={"#ffffff" as never}
              icon={<Plus size={15} color="#ffffff" />}
              style={{ backgroundColor: "var(--ring-todo)" }}
              hoverStyle={{ opacity: 0.9 }}
              pressStyle={{ opacity: 0.82, scale: 0.96 }}
              onPress={handleSubmit}
              disabled={!title.trim() || createTodo.isPending}
              loading={createTodo.isPending}
              loadingText="Adding…"
            >
              Add Todo
            </Button>
            <Button
              intent="outline"
              size="sm"
              type="button"
              icon={<Maximize2 size={15} />}
              onPress={() => setShowFullDialog(true)}
            >
              More
            </Button>
          </XStack>
          <Button intent="ghost" size="sm" type="button" onPress={handleCancel}>
            Cancel
          </Button>
        </XStack>
      </YStack>

      <CreateTodoDialog
        open={showFullDialog}
        onOpenChange={setShowFullDialog}
        listId={selectedListId}
      />
    </>
  );
}
