import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { toast } from "sonner";
import { useAllTodos, useTodoLists, useDeleteTodoList } from "@/lib/api/todos";
import { CreateListDialog } from "./create-list-dialog";
import type { Todo, TodoList } from "@repo/core/types";

interface TodoListSidebarProps {
  onNavigate?: () => void;
}

const linkStyle = { textDecoration: "none" } as const;

// One nav row: leading icon (inherits the row's color), label, optional
// trailing count. Active vs idle drives bg/color; the lucide icon follows
// the row color via currentColor.
function NavRow({
  active,
  icon,
  label,
  count,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  const rowColor = active ? "$color" : "$mutedForeground";
  return (
    <XStack
      group
      items="center"
      gap="$2.5"
      rounded="$md"
      px="$2.5"
      py="$2"
      transition="quick"
      bg={active ? "$accent" : "transparent"}
      hoverStyle={active ? undefined : { bg: "$accent" }}
    >
      <Text
        shrink={0}
        items="center"
        justify="center"
        width={18}
        height={18}
        lineHeight={0}
        color={rowColor}
        $group-hover={active ? undefined : { color: "$color" }}
      >
        {icon}
      </Text>
      <Text
        flex={1}
        fontSize="$3"
        fontWeight={active ? "600" : "500"}
        numberOfLines={1}
        color={rowColor}
        $group-hover={active ? undefined : { color: "$color" }}
      >
        {label}
      </Text>
      {count && count > 0 ? (
        <Text
          fontSize="$1"
          color="$mutedForeground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {count}
        </Text>
      ) : null}
    </XStack>
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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    const viewing = pathname === `/todos/${list.id}`;
    deleteList.mutate(list.id, {
      onSuccess: () => {
        toast.success(`"${list.name}" deleted`);
        if (viewing) void navigate({ to: "/todos" });
      },
      onError: () => toast.error("Failed to delete list"),
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

// Custom-list row: tappable Link (color dot + name) plus a hover-revealed
// kebab menu. The kebab is a sibling of the Link (not nested) so opening it
// never navigates, and it overlays the count so the row doesn't shift.
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
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <XStack
      group
      items="center"
      rounded="$md"
      pr="$2.5"
      transition="quick"
      bg={active ? "$accent" : "transparent"}
      hoverStyle={active ? undefined : { bg: "$accent" }}
    >
      <Link
        to="/todos/$listId"
        params={{ listId: list.id }}
        onClick={onNavigate}
        style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
      >
        <XStack items="center" gap="$2.5" px="$2.5" py="$2" minW={0}>
          <View
            width={10}
            height={10}
            rounded={9999}
            shrink={0}
            style={{ backgroundColor: list.color || "#6b7280" }}
          />
          <Text
            flex={1}
            fontSize="$3"
            fontWeight={active ? "600" : "500"}
            numberOfLines={1}
            color={active ? "$color" : "$mutedForeground"}
            $group-hover={active ? undefined : { color: "$color" }}
          >
            {list.name}
          </Text>
        </XStack>
      </Link>

      {/* trailing: count (idle) ↔ kebab (hover / menu open) */}
      <View
        width={28}
        height={28}
        shrink={0}
        items="center"
        justify="center"
        position="relative"
      >
        {count && count > 0 ? (
          <Text
            position="absolute"
            fontSize="$1"
            color="$mutedForeground"
            transition="quick"
            opacity={menuOpen ? 0 : 1}
            $group-hover={{ opacity: 0 }}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {count}
          </Text>
        ) : null}
        <View
          position="absolute"
          transition="quick"
          opacity={menuOpen ? 1 : 0}
          $group-hover={{ opacity: 1 }}
        >
          <ListMenu list={list} open={menuOpen} onOpenChange={setMenuOpen} />
        </View>
      </View>
    </XStack>
  );
}

export function TodoListSidebar({ onNavigate }: TodoListSidebarProps = {}) {
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

  return (
    <YStack height="100%" width="100%" bg="$card">
      <YStack
        tag="nav"
        flex={1}
        gap="$0.5"
        overflowY={"auto" as never}
        p="$2"
        pt="$3"
      >
        {isLoading && (
          <Text px="$3" py="$2" fontSize="$1" color="$mutedForeground">
            Loading…
          </Text>
        )}

        <Link to={basePath} onClick={onNavigate} style={linkStyle}>
          <NavRow
            active={pathname === basePath}
            icon={<Sun size={18} />}
            label="Today"
            count={todayCount}
          />
        </Link>

        <Link
          to={`${basePath}/upcoming`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow
            active={pathname === `${basePath}/upcoming`}
            icon={<CalendarClock size={18} />}
            label="Upcoming"
            count={upcomingCount}
          />
        </Link>

        <Link to={`${basePath}/inbox`} onClick={onNavigate} style={linkStyle}>
          <NavRow
            active={pathname === `${basePath}/inbox`}
            icon={<Inbox size={18} />}
            label="Inbox"
            count={inboxCount}
          />
        </Link>

        <Link
          to={`${basePath}/completed`}
          onClick={onNavigate}
          style={linkStyle}
        >
          <NavRow
            active={pathname === `${basePath}/completed`}
            icon={<CheckCircle2 size={18} />}
            label="Completed"
          />
        </Link>

        <Separator mx="$2" my="$2" />

        <XStack items="center" justify="space-between" px="$2.5" py="$1.5">
          <Text
            fontSize="$1"
            fontWeight="600"
            letterSpacing={0.5}
            color="$mutedForeground"
            textTransform="uppercase"
          >
            Lists
          </Text>
          <View
            group
            onPress={() => {
              setShowCreateDialog(true);
              onNavigate?.();
            }}
            width={22}
            height={22}
            items="center"
            justify="center"
            rounded="$sm"
            cursor="pointer"
            transition="quick"
            hoverStyle={{ bg: "$accent" }}
            aria-label="Create list"
            role="button"
          >
            <Text
              lineHeight={0}
              color="$mutedForeground"
              $group-hover={{ color: "$color" }}
            >
              <Plus size={15} />
            </Text>
          </View>
        </XStack>

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
      </YStack>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </YStack>
  );
}
