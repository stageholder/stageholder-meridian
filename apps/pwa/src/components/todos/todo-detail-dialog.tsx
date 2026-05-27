import { useState, useRef, useEffect } from "react";
import { Check, CheckCircle2, ChevronDown, Trash2, X } from "lucide-react";
import {
  useUpdateTodo,
  useDeleteTodo,
  useAddSubtask,
  useUpdateSubtask,
  useRemoveSubtask,
} from "@/lib/api/todos";
import {
  Button,
  DatePicker,
  Dialog,
  IconButton,
  Input,
  Separator,
  TextArea,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
// The kit Input is a frame-compound and doesn't forward refs to the inner
// DOM input; the inline-edit title field needs direct .focus()/.blur()/
// .selectionStart access, so use the raw Tamagui Input (forwards ref to the
// DOM node on web) plus Form for the subtask Enter-to-submit. Neither is
// re-exported by the kit yet.
import { Form, Input as RawInput } from "tamagui";
import { format } from "date-fns";
import { toast } from "sonner";
import { parseDateLocal } from "@/lib/date";
import type { Todo } from "@repo/core/types";

// Priority dot colors — fixed brand swatches matching the shadcn palette
// (red/orange/yellow/blue-500). Decorative indicators kept as inline hex
// (no kit token for arbitrary swatches); `none` uses the muted token.
const priorityConfig: Record<string, { label: string; dot: string | null }> = {
  urgent: { label: "Urgent", dot: "#ef4444" },
  high: { label: "High", dot: "#f97316" },
  medium: { label: "Medium", dot: "#eab308" },
  low: { label: "Low", dot: "#3b82f6" },
  none: { label: "None", dot: null },
};

const priorityOptions = ["urgent", "high", "medium", "low", "none"] as const;

interface TodoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo;
  listId: string;
}

export function TodoDetailDialog({
  open,
  onOpenChange,
  todo,
  listId,
}: TodoDetailDialogProps) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const removeSubtask = useRemoveSubtask();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleCancelledRef = useRef(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(todo.description ?? "");
  const descRef = useRef<HTMLTextAreaElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const isDone = todo.status === "done";
  const priority = priorityConfig[todo.priority] ?? priorityConfig.none!;

  // Sync drafts when todo changes externally
  useEffect(() => {
    if (!editingTitle) setTitleDraft(todo.title);
  }, [todo.title, editingTitle]);

  useEffect(() => {
    if (!editingDesc) setDescDraft(todo.description ?? "");
  }, [todo.description, editingDesc]);

  // Auto-focus inputs when entering edit mode
  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.selectionStart = titleRef.current.value.length;
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingDesc && descRef.current) {
      descRef.current.focus();
      descRef.current.selectionStart = descRef.current.value.length;
    }
  }, [editingDesc]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        priorityRef.current &&
        !priorityRef.current.contains(e.target as Node)
      )
        setPriorityOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleUpdateField(data: Record<string, unknown>) {
    updateTodo.mutate({ listId, todoId: todo.id, data });
  }

  function handleSaveTitle() {
    if (titleCancelledRef.current) {
      titleCancelledRef.current = false;
      return;
    }
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== todo.title) {
      handleUpdateField({ title: trimmed });
    }
    if (!trimmed) setTitleDraft(todo.title);
    setEditingTitle(false);
  }

  function handleSaveDescription() {
    const trimmed = descDraft.trim();
    const current = todo.description ?? "";
    if (trimmed !== current) {
      handleUpdateField({ description: trimmed || null });
    }
    setEditingDesc(false);
  }

  function handleToggleStatus() {
    updateTodo.mutate({
      listId,
      todoId: todo.id,
      data: { status: isDone ? "todo" : "done" },
    });
  }

  function handleDelete() {
    deleteTodo.mutate(
      { listId, todoId: todo.id },
      {
        onSuccess: () => {
          toast.success("Todo deleted");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to delete todo");
        },
      },
    );
  }

  const formattedCreatedAt = new Date(todo.createdAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  const formattedUpdatedAt = new Date(todo.updatedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          width="90%"
          maxW={672}
          maxH={"86vh" as never}
          overflow={"auto" as never}
          // Header / columns own their own padding; the kit Content default
          // p="$5" gap="$4" would double up, so zero them here.
          p={0}
          gap={0}
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
          {/* a11y title/description — the visible title is the editable
              header field below; these satisfy Tamagui's ARIA dev-checks
              without altering the layout. */}
          <Dialog.Title
            position={"absolute" as never}
            width={1}
            height={1}
            overflow="hidden"
            style={{ clip: "rect(0 0 0 0)" }}
          >
            {todo.title}
          </Dialog.Title>
          <Dialog.Description
            position={"absolute" as never}
            width={1}
            height={1}
            overflow="hidden"
            style={{ clip: "rect(0 0 0 0)" }}
          >
            View and edit todo details, subtasks, priority, and dates.
          </Dialog.Description>
          {/* Header */}
          <XStack
            items="flex-start"
            gap="$3"
            borderBottomWidth={1}
            borderColor="$borderColor"
            p="$5"
          >
            <View
              onPress={handleToggleStatus}
              mt="$0.5"
              width={20}
              height={20}
              shrink={0}
              items="center"
              justify="center"
              rounded={9999}
              borderWidth={2}
              transition="quick"
              borderColor={isDone ? "$primary" : "$mutedForeground"}
              bg={isDone ? "$primary" : "transparent"}
              hoverStyle={isDone ? undefined : { borderColor: "$primary" }}
              role="checkbox"
              aria-checked={isDone}
              aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
            >
              {isDone && (
                <Text color="$primaryForeground" lineHeight={0}>
                  <Check size={12} strokeWidth={3} />
                </Text>
              )}
            </View>
            <YStack flex={1} minW={0}>
              {editingTitle ? (
                <RawInput
                  ref={titleRef as never}
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  {...({
                    onKeyDown: (e: {
                      key: string;
                      preventDefault: () => void;
                    }) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        titleRef.current?.blur();
                      }
                      if (e.key === "Escape") {
                        titleCancelledRef.current = true;
                        setTitleDraft(todo.title);
                        setEditingTitle(false);
                      }
                    },
                  } as object)}
                  onBlur={handleSaveTitle}
                  unstyled
                  width="100%"
                  bg="transparent"
                  fontSize="$5"
                  fontWeight="600"
                  color="$color"
                  borderWidth={0}
                  borderBottomWidth={2}
                  borderColor="$primary"
                  pb={2}
                  outlineWidth={0}
                  focusVisibleStyle={{ outlineWidth: 0 }}
                />
              ) : (
                <Text
                  onPress={() => setEditingTitle(true)}
                  fontSize="$5"
                  fontWeight="600"
                  color={isDone ? "$mutedForeground" : "$color"}
                  textDecorationLine={isDone ? "line-through" : "none"}
                  cursor="pointer"
                  rounded="$2"
                  px="$1"
                  mx={-4}
                  transition="quick"
                  hoverStyle={{ bg: "$accent" }}
                  title="Click to edit title"
                >
                  {titleDraft}
                </Text>
              )}
              {isDone && (
                <XStack mt="$1" items="center" gap="$1">
                  <Text color="$success" lineHeight={0}>
                    <CheckCircle2 size={12} />
                  </Text>
                  <Text fontSize="$1" color="$success">
                    Completed
                  </Text>
                </XStack>
              )}
            </YStack>
            <IconButton
              variant="ghost"
              size="sm"
              onPress={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X size={16} />
            </IconButton>
          </XStack>

          {/* Body — two columns */}
          <YStack $md={{ flexDirection: "row" }}>
            {/* Left column: Description & Subtasks */}
            <YStack
              flex={1}
              gap="$4"
              p="$5"
              minW={0}
              borderBottomWidth={1}
              borderColor="$borderColor"
              $md={{
                borderBottomWidth: 0,
                borderRightWidth: 1,
              }}
            >
              {/* Description (editable) */}
              <YStack>
                <XStack items="center" justify="space-between">
                  <Text
                    fontSize="$1"
                    fontWeight="500"
                    letterSpacing={0.5}
                    color="$mutedForeground"
                    textTransform="uppercase"
                  >
                    Description
                  </Text>
                  {!editingDesc && (
                    <Text
                      onPress={() => setEditingDesc(true)}
                      cursor="pointer"
                      fontSize="$1"
                      color="$mutedForeground"
                      transition="quick"
                      hoverStyle={{ color: "$color" }}
                    >
                      {todo.description ? "Edit" : "Add"}
                    </Text>
                  )}
                </XStack>
                {editingDesc ? (
                  <YStack mt="$1.5">
                    <TextArea
                      ref={descRef as never}
                      value={descDraft}
                      onChangeText={setDescDraft}
                      {...({
                        onKeyDown: (e: {
                          key: string;
                          metaKey: boolean;
                          ctrlKey: boolean;
                        }) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleSaveDescription();
                          }
                          if (e.key === "Escape") {
                            setDescDraft(todo.description ?? "");
                            setEditingDesc(false);
                          }
                        },
                      } as object)}
                      placeholder="Add a description..."
                      rows={3}
                      width="100%"
                      bg="transparent"
                      px="$3"
                      py="$2"
                      fontSize="$3"
                      // resize: web-only CSS, no Tamagui prop equivalent.
                      style={{ resize: "none" }}
                    />
                    <XStack mt="$1.5" items="center" gap="$2">
                      <Button
                        size="sm"
                        type="button"
                        onPress={handleSaveDescription}
                      >
                        Save
                      </Button>
                      <Button
                        intent="ghost"
                        size="sm"
                        type="button"
                        onPress={() => {
                          setDescDraft(todo.description ?? "");
                          setEditingDesc(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Text ml="auto" fontSize={10} color="$mutedForeground">
                        Cmd+Enter to save
                      </Text>
                    </XStack>
                  </YStack>
                ) : todo.description ? (
                  <Text
                    onPress={() => setEditingDesc(true)}
                    mt="$1.5"
                    fontSize="$3"
                    color="$color"
                    cursor="pointer"
                    rounded="$md"
                    px="$2"
                    py="$1.5"
                    mx={-8}
                    transition="quick"
                    hoverStyle={{ bg: "$accent" }}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {todo.description}
                  </Text>
                ) : (
                  <Text
                    onPress={() => setEditingDesc(true)}
                    mt="$1.5"
                    fontSize="$3"
                    fontStyle="italic"
                    color="$mutedForeground"
                    cursor="pointer"
                    rounded="$md"
                    px="$2"
                    py="$1.5"
                    mx={-8}
                    transition="quick"
                    hoverStyle={{ bg: "$accent" }}
                  >
                    Click to add a description...
                  </Text>
                )}
              </YStack>

              {/* Subtasks */}
              <YStack>
                <XStack items="center" justify="space-between">
                  <Text
                    fontSize="$1"
                    fontWeight="500"
                    letterSpacing={0.5}
                    color="$mutedForeground"
                    textTransform="uppercase"
                  >
                    Subtasks
                    {todo.subtasks &&
                      todo.subtasks.length > 0 &&
                      ` ${todo.subtasks.filter((s) => s.status === "done").length}/${todo.subtasks.length}`}
                  </Text>
                </XStack>
                {todo.subtasks && todo.subtasks.length > 0 && (
                  <YStack mt="$2" gap="$0.5">
                    {[...todo.subtasks]
                      .sort((a, b) => a.order - b.order)
                      .map((subtask) => (
                        <XStack
                          key={subtask.id}
                          group
                          items="center"
                          gap="$2"
                          rounded="$md"
                          px="$1"
                          py="$1"
                          hoverStyle={{ bg: "$accent" }}
                        >
                          <View
                            onPress={() =>
                              updateSubtask.mutate({
                                listId,
                                todoId: todo.id,
                                subtaskId: subtask.id,
                                data: {
                                  status:
                                    subtask.status === "done" ? "todo" : "done",
                                },
                              })
                            }
                            width={16}
                            height={16}
                            shrink={0}
                            items="center"
                            justify="center"
                            rounded="$2"
                            borderWidth={1}
                            transition="quick"
                            borderColor={
                              subtask.status === "done"
                                ? "$primary"
                                : "$mutedForeground"
                            }
                            bg={
                              subtask.status === "done"
                                ? "$primary"
                                : "transparent"
                            }
                            hoverStyle={
                              subtask.status === "done"
                                ? undefined
                                : { borderColor: "$primary" }
                            }
                            role="checkbox"
                            aria-checked={subtask.status === "done"}
                            aria-label={
                              subtask.status === "done"
                                ? "Mark subtask incomplete"
                                : "Mark subtask complete"
                            }
                          >
                            {subtask.status === "done" && (
                              <Text color="$primaryForeground" lineHeight={0}>
                                <Check size={10} strokeWidth={3} />
                              </Text>
                            )}
                          </View>
                          <Text
                            flex={1}
                            fontSize="$3"
                            color={
                              subtask.status === "done"
                                ? "$mutedForeground"
                                : "$color"
                            }
                            textDecorationLine={
                              subtask.status === "done"
                                ? "line-through"
                                : "none"
                            }
                          >
                            {subtask.title}
                          </Text>
                          <View
                            group
                            onPress={() =>
                              removeSubtask.mutate({
                                listId,
                                todoId: todo.id,
                                subtaskId: subtask.id,
                              })
                            }
                            width={20}
                            height={20}
                            shrink={0}
                            items="center"
                            justify="center"
                            rounded="$2"
                            cursor="pointer"
                            transition="quick"
                            opacity={1}
                            $md={{ opacity: 0 }}
                            $group-hover={{ opacity: 1 }}
                            aria-label="Delete subtask"
                            role="button"
                          >
                            <Text
                              color="$mutedForeground"
                              lineHeight={0}
                              hoverStyle={{ color: "$destructive" }}
                            >
                              <X size={12} />
                            </Text>
                          </View>
                        </XStack>
                      ))}
                  </YStack>
                )}
                <Form
                  mt={7}
                  onSubmit={() => {
                    const title = newSubtaskTitle.trim();
                    if (!title) return;
                    addSubtask.mutate(
                      { listId, todoId: todo.id, data: { title } },
                      {
                        onSuccess: () => setNewSubtaskTitle(""),
                      },
                    );
                  }}
                >
                  <Input
                    value={newSubtaskTitle}
                    onChangeText={setNewSubtaskTitle}
                    placeholder="Add subtask..."
                    size="$3"
                  />
                </Form>
              </YStack>
            </YStack>

            {/* Right column: Task details (interactive) */}
            <YStack
              width="100%"
              gap="$1"
              p="$3"
              $md={{ width: 240, flexShrink: 0 }}
            >
              {/* Priority */}
              {/* DOM ref drives click-outside (.contains); Tamagui forwards the
                real node on web, so cast past the TamaguiElement ref type. */}
              <View ref={priorityRef as never} position="relative">
                <Text
                  px="$2"
                  fontSize={10}
                  fontWeight="500"
                  letterSpacing={0.5}
                  color="$mutedForeground"
                  textTransform="uppercase"
                >
                  Priority
                </Text>
                <XStack
                  onPress={() => setPriorityOpen(!priorityOpen)}
                  cursor="pointer"
                  mt="$0.5"
                  width="100%"
                  items="center"
                  gap="$2"
                  rounded="$md"
                  px="$2"
                  py="$1.5"
                  transition="quick"
                  hoverStyle={{ bg: "$accent" }}
                >
                  {priority.dot ? (
                    <View
                      width={10}
                      height={10}
                      rounded={9999}
                      style={{ backgroundColor: priority.dot }}
                    />
                  ) : (
                    <View
                      width={10}
                      height={10}
                      rounded={9999}
                      bg="$mutedForeground"
                    />
                  )}
                  <Text fontSize="$3" color="$color">
                    {priority.label}
                  </Text>
                  <Text ml="auto" color="$mutedForeground" lineHeight={0}>
                    <ChevronDown size={12} />
                  </Text>
                </XStack>
                {priorityOpen && (
                  <YStack
                    position="absolute"
                    l={0}
                    r={0}
                    z={10}
                    mt="$1"
                    rounded="$lg"
                    borderWidth={1}
                    borderColor="$borderColor"
                    bg="$popover"
                    p="$1"
                    boxShadow="0 8px 24px rgba(0,0,0,0.18)"
                  >
                    {priorityOptions.map((key) => {
                      const p = priorityConfig[key]!;
                      return (
                        <XStack
                          key={key}
                          onPress={() => {
                            handleUpdateField({ priority: key });
                            setPriorityOpen(false);
                          }}
                          cursor="pointer"
                          width="100%"
                          items="center"
                          gap="$2"
                          rounded="$md"
                          px="$2"
                          py="$1.5"
                          transition="quick"
                          bg={todo.priority === key ? "$accent" : "transparent"}
                          hoverStyle={{ bg: "$accent" }}
                        >
                          {p.dot ? (
                            <View
                              width={10}
                              height={10}
                              rounded={9999}
                              style={{ backgroundColor: p.dot }}
                            />
                          ) : (
                            <View
                              width={10}
                              height={10}
                              rounded={9999}
                              bg="$mutedForeground"
                            />
                          )}
                          <Text fontSize="$3" color="$color">
                            {p.label}
                          </Text>
                          {todo.priority === key && (
                            <Text ml="auto" color="$primary" lineHeight={0}>
                              <Check size={12} strokeWidth={2.5} />
                            </Text>
                          )}
                        </XStack>
                      );
                    })}
                  </YStack>
                )}
              </View>

              <Separator mt="$3" />

              {/* Due Date */}
              <YStack>
                <Text
                  px="$2"
                  fontSize={10}
                  fontWeight="500"
                  letterSpacing={0.5}
                  color="$mutedForeground"
                  textTransform="uppercase"
                >
                  Due Date
                </Text>
                <View mt="$0.5" px="$1">
                  <DatePicker
                    value={todo.dueDate ? parseDateLocal(todo.dueDate) : null}
                    onChange={(d) =>
                      handleUpdateField({
                        dueDate: d ? format(d, "yyyy-MM-dd") : null,
                      })
                    }
                    placeholder="Set due date"
                    presets={["today", "tomorrow", "next-week"]}
                    headerStyle="compact"
                    showClear
                  />
                </View>
              </YStack>

              {/* Do Date */}
              <YStack>
                <Text
                  px="$2"
                  fontSize={10}
                  fontWeight="500"
                  letterSpacing={0.5}
                  color="$mutedForeground"
                  textTransform="uppercase"
                >
                  Do Date
                </Text>
                <View mt="$0.5" px="$1">
                  <DatePicker
                    value={todo.doDate ? parseDateLocal(todo.doDate) : null}
                    onChange={(d) =>
                      handleUpdateField({
                        doDate: d ? format(d, "yyyy-MM-dd") : null,
                      })
                    }
                    placeholder="Set do date"
                    presets={["today", "tomorrow", "next-week"]}
                    headerStyle="compact"
                    showClear
                  />
                </View>
              </YStack>

              {/* Timestamps & Delete */}
              <Separator mt="$3" />
              <YStack mt="$3" gap="$2">
                <XStack items="center" justify="space-between" px="$2">
                  <Text
                    fontSize={10}
                    fontWeight="500"
                    letterSpacing={0.5}
                    color="$mutedForeground"
                    textTransform="uppercase"
                  >
                    Created
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {formattedCreatedAt}
                  </Text>
                </XStack>
                <XStack items="center" justify="space-between" px="$2">
                  <Text
                    fontSize={10}
                    fontWeight="500"
                    letterSpacing={0.5}
                    color="$mutedForeground"
                    textTransform="uppercase"
                  >
                    Updated
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {formattedUpdatedAt}
                  </Text>
                </XStack>
              </YStack>

              <XStack
                {...({ role: "button", "aria-label": "Delete todo" } as object)}
                onPress={handleDelete}
                cursor="pointer"
                mt="$3"
                width="100%"
                items="center"
                justify="center"
                gap="$1.5"
                rounded="$lg"
                px="$3"
                py="$1.5"
                transition="quick"
                hoverStyle={{ bg: "$destructiveMuted" }}
              >
                <Text color="$destructive" lineHeight={0}>
                  <Trash2 size={12} />
                </Text>
                <Text fontSize="$1" fontWeight="500" color="$destructive">
                  Delete
                </Text>
              </XStack>
            </YStack>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
