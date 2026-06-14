import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
} from "react";
import {
  Target,
  Archive,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  ListTodo,
  CircleCheck,
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
import { useHabits } from "@/lib/api/habits";
import {
  useHabitGroups,
  useDeleteHabitGroup,
  useReorderHabitGroups,
} from "@/lib/api/habit-groups";
import { HabitGroupDialog } from "./habit-group-dialog";
import type { Habit, HabitGroup } from "@repo/core/types";

interface HabitsSidebarProps {
  onNavigate?: () => void;
}

// Shared row dimensions — kept in lock-step with the todo sidebar so both
// secondary rails read as one system: 40px rows, $3-rounded inset pills.
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

// Width of the hover-reveal drag-handle gutter on group rows. Small + reserved
// (so the row never shifts) — much tighter than TreeView's forced handle+chevron
// slots, which read as a big center-ward indent.
const HANDLE_W = 18;

/** Trailing count, right-aligned, tabular so digits don't jitter. */
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
 * One primary nav row (All habits / Archived). Mirrors the todo sidebar's
 * `NavButton` — kit `Sidebar.MenuButton` owns frame + press/hover/active; we
 * pass a 14px label child (the kit's plain string label caps at 13px).
 */
function NavButton({
  icon,
  label,
  count,
  active,
  onPress,
}: {
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

// Kebab menu for a group — Edit (reuses HabitGroupDialog) / Delete (destructive
// confirm). Mirrors the todo sidebar's ListMenu: controlled open, conditionally-
// mounted AlertDialog so closing UNMOUNTS the scrim.
function GroupMenu({
  group,
  open,
  onOpenChange,
}: {
  group: HabitGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const deleteGroup = useDeleteHabitGroup();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    const viewing = pathname === `/habits/group/${group.id}`;
    deleteGroup.mutate(group.id, {
      onSuccess: () => {
        toast.show({ title: `"${group.name}" deleted`, intent: "success" });
        if (viewing) void navigate({ to: "/habits" });
      },
      onError: () =>
        toast.show({ title: "Failed to delete group", intent: "danger" }),
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
          {/* RippleButton (not press-scale) so the menu's anchor doesn't shift
              as it opens — same as the todo sidebar. */}
          <RippleButton
            intent="ghost"
            size="sm"
            iconOnly
            width="$sm"
            aria-label="Group options"
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

      <HabitGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        group={group}
      />

      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>
                Delete &ldquo;{group.name}&rdquo;?
              </AlertDialog.Title>
              <AlertDialog.Description>
                Habits in this group move to Ungrouped. Their history is kept.
              </AlertDialog.Description>
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
 * Group row — ONE full-width pill (matching the nav rows' look). The emoji sits
 * at the pill's left, aligned with the nav rows' icons (no left grip gutter).
 * On hover, a RIGHT-side overlay reveals the drag grip + the Edit/Delete kebab
 * together:
 *   • the grip is the ONLY draggable element (HTML5 DnD; desktop rail, mobile
 *     uses chips), so a normal row click still navigates.
 *   • the overlay is a SIBLING of the pill (clicking it never navigates) and is
 *     `pointerEvents:none` while hidden, so the whole row stays clickable.
 * The pill uses a plain `onPress` + explicit hover/active bg (no latched
 * press-bg), so the highlight never sticks after a drag. Drop target shows a
 * $primary line above it; the dragged row dims.
 */
function GroupNavRow({
  group,
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
  group: HabitGroup;
  index: number;
  active: boolean;
  count: number;
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
  // The visible pill — used as the drag ghost so the WHOLE row lifts (not just
  // the grip icon, which is the HTML5 DnD default).
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
      {/* Drop indicator — accent line above the target row (no layout shift). */}
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

      {/* The row pill — click navigates; hover/active bg matches the nav rows. */}
      <View
        ref={rowRef as never}
        onPress={() => {
          void navigate({
            to: "/habits/group/$groupId",
            params: { groupId: group.id },
          });
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
        {/* Emoji / color dot — at the pill's left edge, aligned with the nav
            rows' icons (no left grip gutter). */}
        {group.icon ? (
          <Text fontSize={14} lineHeight={14}>
            {group.icon}
          </Text>
        ) : (
          <View
            width={10}
            height={10}
            rounded={9999}
            shrink={0}
            style={{ backgroundColor: group.color || "#6b7280" }}
          />
        )}

        {/* Name */}
        <Text
          flex={1}
          fontSize={14}
          color="$sidebarForeground"
          numberOfLines={1}
          fontWeight={active ? "600" : "500"}
          style={{ textAlign: "left", minWidth: 0 } as object}
        >
          {group.name}
        </Text>

        {/* Count — fades on hover so the kebab can take its place. */}
        {count > 0 ? <RowCount value={count} dim /> : null}
      </View>

      {/* Right-side overlay — drag grip + Edit/Delete kebab, both revealed on
          hover. Sibling of the pill (NOT a child) so clicking it never fires the
          pill's navigate. `pointerEvents:none` while hidden so the whole row
          stays clickable; only the grip is draggable (a row click still
          navigates). */}
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
          aria-label={`Reorder ${group.name}`}
          {...({
            draggable: true,
            onDragStart: (e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(index));
              // Lift the WHOLE row as the drag ghost (default would be just the
              // grip icon), anchored under the cursor where it was grabbed.
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
        <GroupMenu group={group} open={menuOpen} onOpenChange={setMenuOpen} />
      </XStack>
    </View>
  );
}

export function HabitsSidebar({ onNavigate }: HabitsSidebarProps = {}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = useRouterState({
    select: (s) => (s.location.search as { status?: string }).status,
  });
  const { data: groups, isLoading } = useHabitGroups();
  const { data: habits } = useHabits();
  const reorderGroups = useReorderHabitGroups();
  const [createOpen, setCreateOpen] = useState(false);

  // Active count per group — `useHabits()` already excludes archived server-side.
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of (habits ?? []) as Habit[]) {
      if (h.groupId) m.set(h.groupId, (m.get(h.groupId) ?? 0) + 1);
    }
    return m;
  }, [habits]);

  const sortedGroups = useMemo(
    () =>
      groups ? [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [],
    [groups],
  );

  // Handle-only drag-reorder. The grip starts the drag; rows are drop targets.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function commitReorder(from: number | null, to: number) {
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === to) return;
    const next = [...sortedGroups];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    // The drop indicator sits ABOVE the target row → insert before it; when
    // moving down, removal shifts the target left by one.
    const target = from < to ? to - 1 : to;
    next.splice(target, 0, moved);
    reorderGroups.mutate({
      items: next.map((g, i) => ({ id: g.id, order: i })),
    });
  }

  return (
    // Secondary sidebar inside the app shell's own <Sidebar.Provider> — scope it
    // in an inert provider (collapsible="none") so kit MenuButtons read THIS
    // context, never the main rail's collapse state. Mirrors the todo sidebar.
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

        {/* Status filters — relative to the index's selected date. */}
        <Sidebar.Menu gap={2}>
          <NavButton
            icon={<Target size={18} />}
            label="All habits"
            count={habits?.length ?? 0}
            active={pathname === "/habits" && !status}
            onPress={() => {
              void navigate({ to: "/habits", search: {} });
              onNavigate?.();
            }}
          />
          <NavButton
            icon={<ListTodo size={18} />}
            label="To do"
            active={pathname === "/habits" && status === "todo"}
            onPress={() => {
              void navigate({ to: "/habits", search: { status: "todo" } });
              onNavigate?.();
            }}
          />
          <NavButton
            icon={<CircleCheck size={18} />}
            label="Done"
            active={pathname === "/habits" && status === "done"}
            onPress={() => {
              void navigate({ to: "/habits", search: { status: "done" } });
              onNavigate?.();
            }}
          />
        </Sidebar.Menu>

        <Sidebar.Separator mx={0} my="$2" />

        {/* GROUPS header + create action. */}
        <XStack items="center" justify="space-between" pr="$1">
          <Sidebar.GroupLabel>Groups</Sidebar.GroupLabel>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Create group"
            onPress={() => {
              setCreateOpen(true);
              onNavigate?.();
            }}
          >
            <Plus size={16} />
          </IconButton>
        </XStack>

        <Sidebar.Menu gap={2}>
          {sortedGroups.map((group, index) => (
            <GroupNavRow
              key={group.id}
              group={group}
              index={index}
              active={pathname === `/habits/group/${group.id}`}
              count={groupCounts.get(group.id) ?? 0}
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

        <Sidebar.Separator mx={0} my="$2" />

        <Sidebar.Menu gap={2}>
          <NavButton
            icon={<Archive size={18} />}
            label="Archived"
            active={pathname === "/habits/archived"}
            onPress={() => {
              void navigate({ to: "/habits/archived" });
              onNavigate?.();
            }}
          />
        </Sidebar.Menu>
      </Sidebar.Content>

      <HabitGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Sidebar.Provider>
  );
}
