import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
} from "lucide-react";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  IconButton,
  Sidebar,
  Text,
  useToast,
  View,
  XStack,
} from "@stageholder/ui";
import { useAllTodos, useTodoLists, useDeleteTodoList } from "@/lib/api/todos";
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

/** Trailing pending-count, right-aligned, tabular so digits don't jitter. */
function RowCount({ value }: { value: number }) {
  return (
    <Text
      fontSize={12}
      color="$mutedForeground"
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
  icon: ReactNode;
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
          <IconButton variant="ghost" size="sm" aria-label="List options">
            <MoreHorizontal size={15} />
          </IconButton>
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
            <Pencil size={15} />
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
            <Trash2 size={15} />
            <DropdownMenu.Label>Delete</DropdownMenu.Label>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <CreateListDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        list={list}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        disableRemoveScroll
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay />
          <AlertDialog.Content>
            <AlertDialog.Title>
              Delete &ldquo;{list.name}&rdquo;?
            </AlertDialog.Title>
            <AlertDialog.Description>
              This permanently deletes the list and can&apos;t be undone.
            </AlertDialog.Description>
            <XStack gap="$2" justify="flex-end" mt="$4">
              <AlertDialog.Cancel asChild>
                <Button intent="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button intent="destructive" onPress={confirmDelete}>
                  Delete
                </Button>
              </AlertDialog.Action>
            </XStack>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog>
    </>
  );
}

/**
 * Custom-list row: a kit `Sidebar.MenuButton` (color dot + name + idle count)
 * with the kebab menu overlaid as a SIBLING (absolutely positioned over the
 * trailing area) rather than nested inside the button — keeping the kebab's
 * DropdownMenu out of the navigable `<button>` so opening it never navigates.
 * The count fades out / the kebab fades in on row hover (or while open).
 */
function ListNavRow({
  list,
  active,
  count,
  onNavigate,
}: {
  list: TodoList;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Sidebar.MenuItem group>
      <Sidebar.MenuButton
        icon={
          <View
            width={10}
            height={10}
            rounded={9999}
            shrink={0}
            style={{ backgroundColor: list.color || "#6b7280" }}
          />
        }
        isActive={active}
        onPress={() => {
          void navigate({ to: "/todos/$listId", params: { listId: list.id } });
          onNavigate?.();
        }}
        trailing={
          count && count > 0 ? (
            <Text
              fontSize={12}
              color="$mutedForeground"
              transition="quick"
              opacity={menuOpen ? 0 : 1}
              $group-hover={{ opacity: 0 }}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {count}
            </Text>
          ) : undefined
        }
        {...ROW_PROPS}
      >
        <Text {...LABEL_PROPS} fontWeight={active ? "600" : "500"}>
          {list.name}
        </Text>
      </Sidebar.MenuButton>

      {/* Kebab overlay — sibling of the button, fades in on hover / when open. */}
      <View
        position="absolute"
        r="$2"
        t={0}
        b={0}
        items="center"
        justify="center"
        transition="quick"
        opacity={menuOpen ? 1 : 0}
        $group-hover={{ opacity: 1 }}
      >
        <ListMenu list={list} open={menuOpen} onOpenChange={setMenuOpen} />
      </View>
    </Sidebar.MenuItem>
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

  const sortedLists = lists
    ? [...lists].sort((a, b) =>
        a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1,
      )
    : [];

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
          {sortedLists
            .filter((list: TodoList) => !list.isDefault)
            .map((list: TodoList) => (
              <ListNavRow
                key={list.id}
                list={list}
                active={pathname === `${basePath}/${list.id}`}
                count={listCounts.get(list.id)}
                onNavigate={onNavigate}
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
