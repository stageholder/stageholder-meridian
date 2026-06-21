import { useRef, useState, useEffect, useCallback } from "react";
import { Plus, Maximize2, Flag, Inbox, Check } from "lucide-react";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import { CreateFab } from "@/components/shared/create-fab";
import {
  Button,
  DropdownMenu,
  QuickDatePicker,
  Text,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
// Form + styled aren't re-exported by the kit yet; pull from the shared tamagui
// dep. `Input` here is the RAW tamagui input (not the kit Input): the kit Input
// locks its height to the size token, which left dead space above the title —
// a bare input with auto height hugs the title text instead.
import { Form, Input as BareInput, styled } from "tamagui";
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

// Shared metadata-row trigger pill — matches the kit QuickDatePicker's `sm`
// pill (px $2.5 / py $1.5 / icon 14 / font $2) so the priority, date, and list
// pills read as one consistent, compact set.
const MetaPill = styled(XStack, {
  name: "MetaPill",
  items: "center",
  gap: "$1.5",
  px: "$2.5",
  py: "$1.5",
  rounded: 999,
  borderWidth: 1,
  borderColor: "$borderColor",
  bg: "$background",
  cursor: "pointer",
  transition: "quick",
  hoverStyle: { bg: "$secondary" },
});

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

// Priority trigger pill + dropdown menu.
function PriorityChip({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0];
  const isSet = value !== "none" && !!current.color;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <MetaPill>
          {isSet ? (
            <Flag size={14} color={current.color ?? undefined} />
          ) : (
            <Text color="$mutedForeground" lineHeight={0}>
              <Flag size={14} />
            </Text>
          )}
          <Text
            fontSize="$2"
            fontWeight="500"
            color={isSet ? "$color" : "$mutedForeground"}
          >
            {isSet ? current.label : "Priority"}
          </Text>
        </MetaPill>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {PRIORITIES.map((p) => (
          <DropdownMenu.Item
            key={p.value}
            onPress={() => {
              onChange(p.value);
              setOpen(false);
            }}
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
            <DropdownMenu.Label>{p.label}</DropdownMenu.Label>
            {value === p.value ? (
              <Text color="$primary" lineHeight={0}>
                <Check size={15} />
              </Text>
            ) : null}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

// List trigger pill + dropdown menu (only rendered when there's more than one list).
function ListChip({
  lists,
  value,
  onChange,
}: {
  lists: TodoList[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = lists.find((l) => l.id === value);
  const isCustom = !!selected && !selected.isDefault;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <MetaPill>
          {isCustom ? (
            <View
              width={8}
              height={8}
              rounded={9999}
              style={{ backgroundColor: selected!.color || "#6b7280" }}
            />
          ) : (
            <Text color="$mutedForeground" lineHeight={0}>
              <Inbox size={14} />
            </Text>
          )}
          <Text
            fontSize="$2"
            fontWeight="500"
            color={isCustom ? "$color" : "$mutedForeground"}
          >
            {selected?.name || "List"}
          </Text>
        </MetaPill>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {lists.map((list) => (
          <DropdownMenu.Item
            key={list.id}
            onPress={() => {
              onChange(list.id);
              setOpen(false);
            }}
          >
            {list.isDefault ? (
              <Text color="$primary" lineHeight={0}>
                <Inbox size={14} />
              </Text>
            ) : (
              <View
                width={8}
                height={8}
                rounded={9999}
                style={{ backgroundColor: list.color || "#6b7280" }}
              />
            )}
            <DropdownMenu.Label>{list.name}</DropdownMenu.Label>
            {value === list.id ? (
              <Text color="$primary" lineHeight={0}>
                <Check size={15} />
              </Text>
            ) : null}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
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
  // Ref to the title input — kit Input forwards refs as of alpha.7, so we
  // re-focus the composer after each submit without remounting.
  const inputRef = useRef<HTMLInputElement>(null);
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();
  const toast = useToast();

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
          inputRef.current?.focus();
        },
        onError: () =>
          toast.show({ title: "Failed to create todo", intent: "danger" }),
      },
    );
  }, [
    title,
    selectedListId,
    priority,
    doDate,
    dueDate,
    createTodo,
    resetForm,
    toast,
  ]);

  const handleActivate = useCallback(() => {
    setIsEditing(true);
    setSelectedListId(listId);
    setDoDate(getToday());
    inputRef.current?.focus();
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
      <>
        {/* Desktop: the inline "Add a todo…" trigger expands the composer.
            Hidden on mobile — the FAB below opens the full create dialog. */}
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
          display="none"
          $md={{ display: "flex" }}
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

        {/* Mobile: a FAB opens the full create dialog (the inline quick-add
            composer is desktop-only). Reuses this component's own dialog +
            list context, so it lands the todo in the current list. */}
        <CreateFab
          label="New todo"
          tintVar="--ring-todo"
          onPress={() => {
            setSelectedListId(listId);
            setShowFullDialog(true);
          }}
        />
        <CreateTodoDialog
          open={showFullDialog}
          onOpenChange={setShowFullDialog}
          listId={selectedListId}
        />
      </>
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
        {/* Title — Form gives Enter-to-submit; the standalone "Add Todo"
            button below shares the same handleSubmit. */}
        <Form onSubmit={() => handleSubmit()} width="100%">
          {/* Bare tamagui Input (NOT the kit Input): the kit Input's Frame
              locks height to the size token ($5 = 52px), which vertically
              centered the title and left ~14px of dead space above it. This
              bare input has auto height so it hugs the title; we re-add only
              the `standard` underline (bottom border, primary on focus) and
              keep the same `$5` font. autoFocus + forwarded ref re-focus after
              each submit. `outlineWidth:0` suppresses Tamagui's focus ring. */}
          <BareInput
            ref={inputRef}
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Todo title…"
            cursor="text"
            width="100%"
            height={"auto" as never}
            px={0}
            py="$1.5"
            rounded={0}
            borderWidth={0}
            borderBottomWidth={1}
            borderColor="$borderColor"
            bg="transparent"
            fontSize="$5"
            fontWeight="500"
            color="$color"
            placeholderTextColor="$mutedForeground"
            outlineWidth={0}
            focusStyle={{ borderColor: "$primary", outlineWidth: 0 }}
            focusVisibleStyle={{ outlineWidth: 0 }}
          />
        </Form>

        {/* Metadata — priority pill + kit quick date pickers (pill-style,
            Todoist-style quick-pick rows) + list pill. */}
        <XStack flexWrap="wrap" items="center" gap="$2">
          <PriorityChip value={priority} onChange={setPriority} />
          <QuickDatePicker
            size="sm"
            value={isoToDate(doDate)}
            onChange={(d) => setDoDate(dateToIso(d))}
            placeholder="Do date"
          />
          <QuickDatePicker
            size="sm"
            value={isoToDate(dueDate)}
            onChange={(d) => setDueDate(dateToIso(d))}
            placeholder="Due date"
          />
          {lists && lists.length > 1 ? (
            <ListChip
              lists={lists}
              value={selectedListId}
              onChange={setSelectedListId}
            />
          ) : null}
        </XStack>

        {/* Footer — [Add Todo] [More] [Cancel] grouped at the left. Cancel
            sits next to More and shares its `outline` size so the two
            secondary actions read as one matched pair. */}
        <XStack items="center" gap="$2">
          <Button
            size="sm"
            type="button"
            borderWidth={0}
            {...({ color: "#ffffff" } as object)}
            icon={<Plus size={15} color="#ffffff" />}
            style={{ backgroundColor: "var(--ring-todo)" }}
            hoverStyle={
              { backgroundColor: "var(--ring-todo)", opacity: 0.9 } as never
            }
            pressStyle={
              {
                backgroundColor: "var(--ring-todo)",
                opacity: 0.82,
                scale: 0.96,
              } as never
            }
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
          <Button
            intent="outline"
            size="sm"
            type="button"
            onPress={handleCancel}
          >
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
