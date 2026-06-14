import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useRef, useState, type DragEvent, type ReactElement } from "react";
import { format } from "date-fns";
import {
  Sun,
  CalendarClock,
  Inbox,
  CheckCircle2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  IconButton,
  RippleButton,
  Sidebar,
  Text,
  useToast,
  View,
  XStack,
} from "@stageholder/ui";
import {
  useAllTodos,
  useTodoLists,
  useDeleteTodoList,
  useReorderTodoLists,
} from "@/lib/api/todos";
import { CreateListDialog } from "./create-list-dialog";
import type { Todo, TodoList } from "@repo/core/types";

interface TodoListSidebarProps {
  onNavigate?: () => void;
}

// Shared row dimensions — kept in lock-step with the main app rail
// (app-shell.tsx) so both sidebars read as one system: 40px rows, 14px
// medium labels, $3-rounded inset pills, $2.5 icon→label gap.
const ROW_PROPS = {
  height: 40,
  rounded: "$3",
  gap: "$2.5",
} as const;

const LABEL_PROPS = {
  flex: 1,
  fontSize: 14,
  color: "$sidebarForeground",
  numberOfLines: 1,
  text: "left",
} as const;

// Width of the hover-reveal drag-handle in a list row's right overlay.
const HANDLE_W = 18;

/** Trailing pending-count, right-aligned, tabular so digits don't jitter.
 *  `dim` fades it out on row hover so the drag grip + kebab can take its place. */
function RowCount({ value, dim }: { value: number; dim?: boolean }) {
  return (
    <Text
      fontSize={12}
      color="$mutedForeground"
      transition="quick"
      opacity={1}
      $group-hover={dim ? { opacity: 0 } : undefined}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </Text>
  );
}

/**
 * One primary nav row (Today / Upcoming / Inbox / Completed) built on the kit
 * `Sidebar.MenuButton` — the kit owns the frame, press/hover/active-bg; we pass
 * a custom 14px label child (the kit's plain-string label caps at 13px).
 */
function NavButton({
  icon,
  label,
  count,
  active,
  onPress,
}: {
  /** Element (not arbitrary ReactNode) — the kit icon slot takes an element. */
  icon: ReactElement;
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton
        icon={icon}
        isActive={active}
        onPress={onPress}
        trailing={count && count > 0 ? <RowCount value={count} /> : undefined}
        {...ROW_PROPS}
      >
        <Text {...LABEL_PROPS} fontWeight={active ? "600" : "500"}>
          {label}
        </Text>
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
}

// Kebab menu for a custom list — Edit (reuses the list dialog) / Delete
// (destructive confirm). Controlled open state lets the row keep the kebab
// visible while the menu is open.
function ListMenu({
  list,
  open,
  onOpenChange,
}: {
  list: TodoList;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const deleteList = useDeleteTodoList();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    const viewing = pathname === `/todos/${list.id}`;
    deleteList.mutate(list.id, {
      onSuccess: () => {
        toast.show({ title: `"${list.name}" deleted`, intent: "success" });
        if (viewing) void navigate({ to: "/todos" });
      },
      onError: () =>
        toast.show({ title: "Failed to delete list", intent: "danger" }),
    });
  }

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom-end"
      >
        <DropdownMenu.Trigger asChild>
          {/* RippleButton (not IconButton): ripple press feedback instead of a
              press-scale that would shift the menu's anchor as it opens. */}
          <RippleButton
            intent="ghost"
            size="sm"
            iconOnly
            width="$sm"
            aria-label="List options"
          >
            <MoreHorizontal size={15} />
          </RippleButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content minW={160}>
          <DropdownMenu.Item
            items="center"
            gap="$2"
            onPress={() => {
              onOpenChange(false);
              setEditOpen(true);
            }}
          >
            <Text color="$color" lineHeight={0}>
              <Pencil size={15} />
            </Text>
            <DropdownMenu.Label>Edit</DropdownMenu.Label>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            intent="danger"
            items="center"
            gap="$2"
            onPress={() => {
              onOpenChange(false);
              setDeleteOpen(true);
            }}
          >
            <Text color="$destructive" lineHeight={0}>
              <Trash2 size={15} />
            </Text>
            <DropdownMenu.Label>Delete</DropdownMenu.Label>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <CreateListDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        list={list}
      />

      {/* Conditionally mounted so CLOSING UNMOUNTS the dialog (overlay removed
          instantly). The kit's exit-presence (<Animate presence> →
          onExitComplete) doesn't fire under this app's runtime-CSS setup
          (Tailwind coexistence forces disableExtraction, so the CSS driver's
          exit transitionend never lands) — closing via state alone left the
          scrim stuck. A full unmount, which the delete-mutation path already
          triggers, clears it reliably. */}
      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>
                Delete &ldquo;{list.name}&rdquo;?
              </AlertDialog.Title>
              <AlertDialog.Description>
                This permanently deletes the list and can&apos;t be undone.
              </AlertDialog.Description>
              {/* Close via the kit Button's own onPress + the controlled open
                state (the proven update-checker.tsx pattern). Wrapping a kit
                Button in AlertDialog.Cancel/Action asChild left the overlay
                stuck after Cancel: DialogClose's slotted close handler didn't
                reliably drive our controlled onOpenChange, so the dialog state
                never flipped to closed and the scrim stayed up. Driving the
                close from onPress makes it deterministic. */}
              <XStack gap="$2" justify="flex-end" mt="$4">
                <Button intent="outline" onPress={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  intent="destructive"
                  onPress={() => {
                    setDeleteOpen(false);
                    confirmDelete();
                  }}
                >
                  Delete
                </Button>
              </XStack>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog>
      )}
    </>
  );
}

/**
 * Custom-list row — ONE full-width pill (matching the nav rows). The color dot
 * sits at the pill's left, aligned with the nav icons. On hover, a RIGHT-side
 * overlay reveals the drag grip + the Edit/Delete kebab together:
 *   • the grip is the ONLY draggable element (HTML5 DnD), so a row click still
 *     navigates; it lifts the WHOLE row as the drag ghost.
 *   • the overlay is a SIBLING of the pill (clicking it never navigates) and is
 *     `pointerEvents:none` while hidden, so the whole row stays clickable.
 * Plain `onPress` + explicit hover/active bg (no latched press-bg) → the
 * highlight never sticks after a drag. Drop target shows a $primary line above.
 * (Exact parity with the habits group sidebar.)
 */
function ListNavRow({
  list,
  index,
  active,
  count,
  dragging,
  isOver,
  onNavigate,
  onDragStartHandle,
  onDragEndHandle,
  onDragOverRow,
  onDropRow,
}: {
  list: TodoList;
  index: number;
  active: boolean;
  count?: number;
  dragging: boolean;
  isOver: boolean;
  onNavigate?: () => void;
  onDragStartHandle: () => void;
  onDragEndHandle: () => void;
  onDragOverRow: () => void;
  onDropRow: () => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLElement | null>(null);
  return (
    <View
      group
      position="relative"
      opacity={dragging ? 0.4 : 1}
      {...({
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverRow();
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          onDropRow();
        },
      } as object)}
    >
      {isOver ? (
        <View
          position="absolute"
          l="$2"
          r="$2"
          t={-1}
          height={2}
          rounded="$pill"
          bg="$primary"
          pointerEvents="none"
          style={{ zIndex: 1 } as object}
        />
      ) : null}

      <View
        ref={rowRef as never}
        onPress={() => {
          void navigate({ to: "/todos/$listId", params: { listId: list.id } });
          onNavigate?.();
        }}
        cursor="pointer"
        height={ROW_PROPS.height}
        rounded={ROW_PROPS.rounded}
        flexDirection="row"
        items="center"
        gap="$2.5"
        px="$2"
        transition="quick"
        bg={active ? "$sidebarAccent" : "transparent"}
        hoverStyle={{ bg: "$sidebarAccent" }}
      >
        <View
          width={10}
          height={10}
          rounded={9999}
          shrink={0}
          style={{ backgroundColor: list.color || "#6b7280" }}
        />
        <Text
          flex={1}
          fontSize={14}
          color="$sidebarForeground"
          numberOfLines={1}
          fontWeight={active ? "600" : "500"}
          style={{ textAlign: "left", minWidth: 0 } as object}
        >
          {list.name}
        </Text>
        {count && count > 0 ? <RowCount value={count} dim /> : null}
      </View>

      {/* Right-side overlay — drag grip + Edit/Delete kebab, revealed on hover.
          `pointerEvents:none` while hidden so the whole row stays clickable. */}
      <XStack
        position="absolute"
        r="$2"
        t={0}
        b={0}
        items="center"
        gap="$1"
        transition="quick"
        opacity={menuOpen ? 1 : 0}
        pointerEvents={menuOpen ? "auto" : "none"}
        $group-hover={{ opacity: 1, pointerEvents: "auto" }}
      >
        <View
          width={HANDLE_W}
          height={ROW_PROPS.height}
          items="center"
          justify="center"
          cursor="grab"
          transition="quick"
          hoverStyle={{ opacity: 0.7 }}
          aria-label={`Reorder ${list.name}`}
          {...({
            draggable: true,
            onDragStart: (e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(index));
              // Lift the whole row as the drag ghost (not just the grip icon).
              const el = rowRef.current;
              if (el) {
                const rect = el.getBoundingClientRect();
                e.dataTransfer.setDragImage(
                  el,
                  e.clientX - rect.left,
                  e.clientY - rect.top,
                );
              }
              onDragStartHandle();
            },
            onDragEnd: () => onDragEndHandle(),
          } as object)}
        >
          <Text color="$mutedForeground" lineHeight={0}>
            <GripVertical size={13} />
          </Text>
        </View>
        <ListMenu list={list} open={menuOpen} onOpenChange={setMenuOpen} />
      </XStack>
    </View>
  );
}

export function TodoListSidebar({ onNavigate }: TodoListSidebarProps = {}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: lists, isLoading } = useTodoLists();
  const { data: allTodos } = useAllTodos();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const basePath = "/todos";

  // ── Live counts ──────────────────────────────────────────────────────────
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const pending = (allTodos ?? []).filter((t: Todo) => t.status !== "done");

  const isDueByToday = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due <= todayStr) || (!!doDate && doDate <= todayStr);
  };
  const isFuture = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due > todayStr) || (!!doDate && doDate > todayStr);
  };

  const todayCount = pending.filter(isDueByToday).length;
  const upcomingCount = pending.filter(
    (t) => !isDueByToday(t) && isFuture(t),
  ).length;
  const inboxCount = pending.length;

  const listCounts = new Map<string, number>();
  for (const t of pending) {
    listCounts.set(t.listId, (listCounts.get(t.listId) ?? 0) + 1);
  }

  // Custom (non-default) lists, ordered for the draggable "Lists" section. The
  // default Inbox lives in the primary nav, not here, so it isn't reorderable.
  const customLists = lists
    ? [...lists]
        .filter((l: TodoList) => !l.isDefault)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  // Handle-only drag-reorder (the grip on each list row) — mirrors the habits
  // group sidebar.
  const reorderLists = useReorderTodoLists();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function commitReorder(from: number | null, to: number) {
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === to) return;
    const next = [...customLists];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    // Drop indicator sits ABOVE the target → insert before it; moving down
    // shifts the target left by one after removal.
    const target = from < to ? to - 1 : to;
    next.splice(target, 0, moved);
    reorderLists.mutate({
      items: next.map((l, i) => ({ id: l.id, order: i })),
    });
  }

  const go = (onPress: () => void) => () => {
    onPress();
    onNavigate?.();
  };

  return (
    // The todo panel is a SECONDARY sidebar that renders inside the app shell's
    // own <Sidebar.Provider>. We scope it in its own inert provider
    // (collapsible="none") so the kit MenuButtons read THIS context — never the
    // main rail's collapse state — and never iconify. No <Sidebar> frame is
    // rendered; we only use the Menu/Group primitives.
    <Sidebar.Provider
      collapsible="none"
      bg="$sidebar"
      height="100%"
      width="100%"
    >
      <Sidebar.Content px="$2" pt="$3" pb="$2" gap="$1">
        {isLoading && (
          <Text px="$3" py="$2" fontSize="$1" color="$mutedForeground">
            Loading…
          </Text>
        )}

        <Sidebar.Menu gap={2}>
          <NavButton
            icon={<Sun size={18} />}
            label="Today"
            count={todayCount}
            active={pathname === basePath}
            onPress={go(() => void navigate({ to: "/todos" }))}
          />
          <NavButton
            icon={<CalendarClock size={18} />}
            label="Upcoming"
            count={upcomingCount}
            active={pathname === `${basePath}/upcoming`}
            onPress={go(() => void navigate({ to: "/todos/upcoming" }))}
          />
          <NavButton
            icon={<Inbox size={18} />}
            label="Inbox"
            count={inboxCount}
            active={pathname === `${basePath}/inbox`}
            onPress={go(() => void navigate({ to: "/todos/inbox" }))}
          />
          <NavButton
            icon={<CheckCircle2 size={18} />}
            label="Completed"
            active={pathname === `${basePath}/completed`}
            onPress={go(() => void navigate({ to: "/todos/completed" }))}
          />
        </Sidebar.Menu>

        <Sidebar.Separator mx={0} my="$2" />

        {/* LISTS group header + create action. */}
        <XStack items="center" justify="space-between" pr="$1">
          <Sidebar.GroupLabel>Lists</Sidebar.GroupLabel>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Create list"
            onPress={() => {
              setShowCreateDialog(true);
              onNavigate?.();
            }}
          >
            <Plus size={16} />
          </IconButton>
        </XStack>

        <Sidebar.Menu gap={2}>
          {customLists.map((list: TodoList, index: number) => (
            <ListNavRow
              key={list.id}
              list={list}
              index={index}
              active={pathname === `${basePath}/${list.id}`}
              count={listCounts.get(list.id)}
              onNavigate={onNavigate}
              dragging={dragIndex === index}
              isOver={
                overIndex === index && dragIndex !== null && dragIndex !== index
              }
              onDragStartHandle={() => setDragIndex(index)}
              onDragEndHandle={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOverRow={() => {
                if (dragIndex !== null && overIndex !== index) {
                  setOverIndex(index);
                }
              }}
              onDropRow={() => commitReorder(dragIndex, index)}
            />
          ))}
        </Sidebar.Menu>
      </Sidebar.Content>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </Sidebar.Provider>
  );
}
