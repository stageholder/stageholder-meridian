import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Maximize2 } from "lucide-react";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import { CreateFab } from "@/components/shared/create-fab";
import { Button, Text, toast, XStack, YStack } from "@stageholder/ui";
import { parseSmartTodo } from "@repo/core/todos/smart-parse";
import type { SmartParseResult } from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import {
  SmartTodoInput,
  type SmartTodoInputHandle,
} from "@repo/features/todos";

interface QuickAddTodoProps {
  listId: string;
}

/**
 * Todoist-style quick-add. The composer is a single smart field
 * (`SmartTodoInput`): type the task and any of a natural-language date
 * ("tomorrow", "next fri", "Jun 12"), `!p1..!p4` for priority, or `#list` — each
 * is highlighted in place and previewed as a removable chip. All parsing is the
 * shared `parseSmartTodo` (see `@repo/core/todos/smart-parse`), so the value
 * that gets saved is exactly what the pills show. "More" opens the full GUI
 * dialog for anyone who prefers pickers; mobile uses the FAB → dialog.
 */
export function QuickAddTodo({ listId }: QuickAddTodoProps) {
  const [text, setText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);
  const [selectedListId, setSelectedListId] = useState(listId);
  const inputRef = useRef<SmartTodoInputHandle>(null);
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();
  // Synchronous double-submit latch — two Enters in one tick both pass
  // `isPending` (which only flips next render), so this ref closes the window.
  const submittingRef = useRef(false);

  const listRefs = useMemo(
    () =>
      (lists ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        isDefault: l.isDefault,
      })),
    [lists],
  );
  // Auto-detected device language (English stays active too).
  const smartLocale = useMemo(() => resolveSmartLocale(), []);

  // Re-sync the destination when the route's list changes (navigating between
  // list pages reuses this instance).
  useEffect(() => {
    setSelectedListId(listId);
  }, [listId]);

  const resetForm = useCallback(() => {
    setText("");
    setSelectedListId(listId);
  }, [listId]);

  function handleCancel() {
    setIsEditing(false);
    resetForm();
  }

  const handleSubmit = useCallback(
    (result: SmartParseResult) => {
      if (!result.title.trim() || createTodo.isPending || submittingRef.current)
        return;
      submittingRef.current = true;
      createTodo.mutate(
        {
          // A typed `#list` wins; otherwise the current list is the destination.
          listId: result.listId ?? selectedListId,
          data: {
            title: result.title,
            priority: result.priority,
            doDate: result.doDate,
            dueDate: result.dueDate,
          },
        },
        {
          onSuccess: () => {
            // Keep the composer open + refocused for rapid entry.
            resetForm();
            inputRef.current?.focus();
          },
          onError: () => toast.error("Failed to create todo"),
          onSettled: () => {
            submittingRef.current = false;
          },
        },
      );
    },
    [createTodo, selectedListId, resetForm],
  );

  const handleActivate = useCallback(() => {
    setIsEditing(true);
    setSelectedListId(listId);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [listId]);

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
            Hidden on mobile — the FAB opens the full create dialog. */}
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
        gap="$2.5"
      >
        <SmartTodoInput
          ref={inputRef}
          value={text}
          onValueChange={setText}
          lists={listRefs}
          locale={smartLocale}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          autoFocus
          placeholder="Task name — try “tomorrow”, “!p1”, “#work”, “by friday”"
        />

        {/* Footer — [Add Todo] [More] [Cancel]. */}
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
            onPress={() =>
              handleSubmit(
                parseSmartTodo(text, {
                  lists: listRefs,
                  now: new Date(),
                  locale: smartLocale,
                }),
              )
            }
            disabled={!text.trim() || createTodo.isPending}
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
