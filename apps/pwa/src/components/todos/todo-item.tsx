import { useState, type ReactNode } from "react";
import { format, addDays, nextSaturday, nextMonday } from "date-fns";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Calendar,
  Sun,
  Sofa,
  CalendarClock,
  CalendarX,
  Flag,
} from "lucide-react";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  IconButton,
  Text,
  Tooltip,
  View,
  XStack,
  useToast,
} from "@stageholder/ui";
import { TodoItem as TodoItemView } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";
import {
  useUpdateTodo,
  useDeleteTodo,
  useCreateTodo,
  useTodoLists,
} from "@/lib/api/todos";
import { TodoDetailDialog } from "./todo-detail-dialog";

interface TodoItemProps {
  todo: Todo;
  listId: string;
  /**
   * Show the list badge in the meta row. Set on CROSS-list views (Today,
   * Upcoming) where the destination list isn't obvious; left off on
   * single-list pages (Inbox, a specific list) where it'd be redundant.
   */
  showList?: boolean;
}

// Priority swatches (mirrors quick-add / the meta badge palette).
const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "#ef4444" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "low", label: "Low", color: "#3b82f6" },
  { value: "none", label: "None", color: null },
] as const;

/**
 * PWA wrapper: hooks the todo mutations, manages the detail-dialog open
 * state, and renders the shared cross-platform view.
 *
 * Adds the web-only **actions menu** (Todoist-style) with quick do-date
 * presets, priority, edit, duplicate, delete. The SAME menu opens two ways:
 *  - the trailing **"…" button** → a `DropdownMenu` anchored below the button;
 *  - **right-click** anywhere on the row → the same items anchored to an
 *    invisible 0-size element pinned at the cursor (so it reads as a real
 *    context menu, at the pointer — not floated to the far right).
 * Both render `renderMenuItems`, so content/behavior never drift. (Using a cursor-
 * anchored DropdownMenu rather than the kit `ContextMenu` avoids wrapping the
 * animated row in a Trigger, which would disturb the list's enter/exit
 * animations.)
 */
export function TodoItem({ todo, listId, showList }: TodoItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [btnOpen, setBtnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();
  const toast = useToast();

  const isDone = todo.status === "done";

  // Surface the todo's list as a badge only on cross-list views (`showList`)
  // AND when the user actually has >1 list — otherwise it's redundant noise.
  const showListBadge = !!showList && !!lists && lists.length > 1;
  const todoList = showListBadge
    ? lists.find((l) => l.id === todo.listId)
    : undefined;

  // Quick do-date presets — icon-only (compact, Todoist-style); the label is
  // the tooltip/aria. `null` clears the date ("No date").
  const now = new Date();
  const doDateOptions: {
    label: string;
    value: string | null;
    icon: ReactNode;
  }[] = [
    // Per-preset colors (Todoist-style), literal hex so lucide-react paints
    // the stroke and they read on both light + dark.
    {
      label: "Today",
      value: format(now, "yyyy-MM-dd"),
      icon: <Calendar size={16} color="#22c55e" />, // green
    },
    {
      label: "Tomorrow",
      value: format(addDays(now, 1), "yyyy-MM-dd"),
      icon: <Sun size={16} color="#f59e0b" />, // amber
    },
    {
      label: "This weekend",
      value: format(nextSaturday(now), "yyyy-MM-dd"),
      icon: <Sofa size={16} color="#8b5cf6" />, // violet
    },
    {
      label: "Next week",
      value: format(nextMonday(now), "yyyy-MM-dd"),
      icon: <CalendarClock size={16} color="#3b82f6" />, // blue
    },
    {
      label: "No date",
      value: null,
      icon: <CalendarX size={16} color="#9ca3af" />, // grey
    },
  ];

  function setDoDate(value: string | null, label: string) {
    updateTodo.mutate(
      { listId, todoId: todo.id, data: { doDate: value } },
      {
        onSuccess: () =>
          toast.show({
            title: value === null ? "Do date cleared" : `Scheduled · ${label}`,
            intent: "success",
          }),
        onError: () =>
          toast.show({ title: "Couldn't update do date", intent: "danger" }),
      },
    );
  }

  function setPriority(priority: string) {
    updateTodo.mutate({ listId, todoId: todo.id, data: { priority } });
  }

  function duplicate() {
    createTodo.mutate(
      {
        listId: todo.listId,
        data: {
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          dueDate: todo.dueDate,
          doDate: todo.doDate,
        },
      },
      {
        onSuccess: () =>
          toast.show({ title: "Todo duplicated", intent: "success" }),
        onError: () =>
          toast.show({ title: "Couldn't duplicate todo", intent: "danger" }),
      },
    );
  }

  function handleDelete() {
    deleteTodo.mutate(
      { listId, todoId: todo.id },
      {
        onSuccess: () =>
          toast.show({ title: `"${todo.title}" deleted`, intent: "success" }),
        onError: () =>
          toast.show({ title: "Couldn't delete todo", intent: "danger" }),
      },
    );
    setDeleteOpen(false);
  }

  // Shared item builder — rendered identically inside the "…" menu AND the
  // cursor menu so the two never drift. The date + priority sections are
  // compact horizontal ICON rows (Todoist-style); they aren't auto-closing
  // `DropdownMenu.Item`s, so each calls `close()` (the menu is controlled).
  // The text items (Edit/Duplicate/Delete) stay as `DropdownMenu.Item` and
  // auto-close. lucide-react icons use `currentColor`, so they inherit the
  // row/button color (Delete's danger intent tints its trash red).
  const renderMenuItems = (close: () => void) => (
    <>
      <DropdownMenu.Item onPress={() => setDetailOpen(true)}>
        <XStack items="center" gap="$2.5">
          <Pencil size={15} />
          <DropdownMenu.Label>Edit</DropdownMenu.Label>
        </XStack>
      </DropdownMenu.Item>

      <DropdownMenu.Separator />
      <DropdownMenu.SectionLabel>Do date</DropdownMenu.SectionLabel>
      {/* width="100%" + justify="space-around": fill the menu width and spread
          the icons evenly across it (DropdownMenu.Content would otherwise center
          a content-width row). 28px buttons drop the bulky default 32px
          footprint; px="$1" keeps a small inset from the menu edges. */}
      <XStack
        width="100%"
        justify="space-around"
        px="$1"
        pb="$1"
        items="center"
      >
        {doDateOptions.map((opt) => (
          <Tooltip key={opt.label} delay={300} placement="top">
            <Tooltip.Trigger asChild>
              <IconButton
                variant="ghost"
                width={28}
                height={28}
                aria-label={opt.label}
                onPress={() => {
                  setDoDate(opt.value, opt.label);
                  close();
                }}
              >
                {opt.icon}
              </IconButton>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <Tooltip.Arrow />
              <Text fontSize="$2">{opt.label}</Text>
            </Tooltip.Content>
          </Tooltip>
        ))}
      </XStack>

      <DropdownMenu.Separator />
      <DropdownMenu.SectionLabel>Priority</DropdownMenu.SectionLabel>
      <XStack
        width="100%"
        justify="space-around"
        px="$1"
        pb="$1"
        items="center"
      >
        {PRIORITIES.map((p) => {
          const active = todo.priority === p.value;
          return (
            <Tooltip key={p.value} delay={300} placement="top">
              <Tooltip.Trigger asChild>
                <IconButton
                  variant="ghost"
                  width={28}
                  height={28}
                  aria-label={p.label}
                  bg={active ? "$secondary" : "transparent"}
                  onPress={() => {
                    setPriority(p.value);
                    close();
                  }}
                >
                  {/* Filled colored flag for a set priority; outline grey for
                      None. lucide-react takes literal colors (a token would be
                      invisible). */}
                  <Flag
                    size={16}
                    color={p.color ?? "#9ca3af"}
                    {...({ fill: p.color ?? "none" } as object)}
                  />
                </IconButton>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <Tooltip.Arrow />
                <Text fontSize="$2">{p.label}</Text>
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </XStack>

      <DropdownMenu.Separator />
      <DropdownMenu.Item onPress={duplicate}>
        <XStack items="center" gap="$2.5">
          <Copy size={15} />
          <DropdownMenu.Label>Duplicate</DropdownMenu.Label>
        </XStack>
      </DropdownMenu.Item>
      <DropdownMenu.Item intent="danger" onPress={() => setDeleteOpen(true)}>
        <XStack items="center" gap="$2.5">
          <Trash2 size={15} />
          <DropdownMenu.Label>Delete</DropdownMenu.Label>
        </XStack>
      </DropdownMenu.Item>
    </>
  );

  return (
    <>
      <TodoItemView
        todo={todo}
        onToggle={() =>
          updateTodo.mutate({
            listId,
            todoId: todo.id,
            data: { status: isDone ? "todo" : "done" },
          })
        }
        onDelete={() => setDeleteOpen(true)}
        onOpenDetail={() => setDetailOpen(true)}
        listName={todoList?.name}
        listColor={todoList?.color}
        // Right-click → same menu at the pointer (not anchored to the button).
        onContextMenu={(e) => {
          const ev = e as {
            preventDefault?: () => void;
            clientX?: number;
            clientY?: number;
          };
          ev.preventDefault?.();
          setCtxPos({ x: ev.clientX ?? 0, y: ev.clientY ?? 0 });
        }}
        // "…" button → DropdownMenu anchored below it. Hidden until row-hover,
        // pinned visible while open.
        renderActions={() => (
          <DropdownMenu open={btnOpen} onOpenChange={setBtnOpen}>
            <DropdownMenu.Trigger asChild>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Todo actions"
                opacity={btnOpen ? 1 : 0}
                transition="quick"
                $group-hover={{ opacity: 1 }}
              >
                <MoreHorizontal size={16} />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {renderMenuItems(() => setBtnOpen(false))}
            </DropdownMenu.Content>
          </DropdownMenu>
        )}
      />

      {/* Right-click context menu: same items, anchored to a 0-size element
          fixed at the cursor so it opens at the pointer. */}
      {ctxPos ? (
        <DropdownMenu
          open
          onOpenChange={(o) => {
            if (!o) setCtxPos(null);
          }}
          // A cursor menu can open anywhere, so it MUST flip/shift near a
          // viewport edge (the kit omits these by default to avoid a position
          // blink). Per the kit's own guidance, pair them with the Content's
          // `animatePosition` so the reposition animates instead of snapping.
          {...({ allowFlip: true, stayInFrame: true } as object)}
        >
          <DropdownMenu.Trigger asChild>
            <View
              style={{
                position: "fixed",
                left: ctxPos.x,
                top: ctxPos.y,
                width: 0,
                height: 0,
              }}
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            {...({ animatePosition: "even-when-repositioning" } as object)}
          >
            {renderMenuItems(() => setCtxPos(null))}
          </DropdownMenu.Content>
        </DropdownMenu>
      ) : null}

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todo={todo}
        listId={listId}
      />

      {/* Delete confirmation. Conditionally MOUNTED (open when mounted) so
          closing fully unmounts it — this app's runtime-CSS setup
          (disableExtraction for Tailwind coexistence) means the kit's
          exit-presence transitionend never fires, so a state-only close would
          leave the scrim stuck. Mirrors the habit-list-item pattern. */}
      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>Delete todo?</AlertDialog.Title>
              <AlertDialog.Description>
                This will permanently delete &quot;{todo.title}&quot;. This
                action cannot be undone.
              </AlertDialog.Description>
              <XStack gap="$3" justify="flex-end" mt="$4">
                <AlertDialog.Cancel asChild>
                  <Button intent="outline">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button intent="destructive" onPress={handleDelete}>
                    Delete
                  </Button>
                </AlertDialog.Action>
              </XStack>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog>
      )}
    </>
  );
}
