// apps/mobile/app/(authed)/todos.tsx
//
// Todos — the core loop. A list of cross-platform `TodoItem`s (from
// @repo/features) with the toggle-complete + delete mutations wired.
//
// Creation is the FAB: it opens the full CreateTodoDialog (priority, due/do
// dates, list) as a bottom Sheet — the same shared TodoForm the PWA uses. (Its
// title field still supports the "tomorrow !p1 #work" smart-typing.) An inline
// quick-add composer was tried and removed — one create affordance, the FAB, is
// the standard mobile pattern.
//
// PWA parity (condensed for one screen instead of the PWA's five routes):
//   - LIST chips row — All · each list (color dot; tap to filter; tap the
//     pencil on the active list to rename/recolor/delete) · "+ New" (the
//     PWA's sidebar + create-list dialog, as a chips rail).
//   - OPEN todos grouped by date bucket: Overdue / Today / Upcoming /
//     Someday (the PWA's today/upcoming/inbox views, stacked).
//   - COMPLETED section after (the PWA's completed view).
// Tapping a row opens the native EditTodoDialog (shared TodoForm + the
// instant-commit SubtaskSection).

import {
  Banner,
  Button,
  EmptyState,
  Pill,
  Separator,
  SwipeableRow,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { TodoItem, TodoListSkeleton } from "@repo/features/todos";
import {
  formatUpcomingLabel,
  groupUpcomingByDate,
} from "@repo/core/todos/upcoming";
import type { Todo, TodoList } from "@repo/core/types";
import {
  Check,
  ListOrdered,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "@tamagui/lucide-icons-2";
import { format, subDays } from "date-fns";
import { memo, useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView as RNScrollView } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { CreateFab } from "@/components/create-fab";
import { CreateTodoDialog } from "@/components/create-todo-dialog";
import { EditTodoDialog } from "@/components/edit-todo-dialog";
import { TodoListSheet } from "@/components/todo-list-sheet";
import { TodoListReorderSheet } from "@/components/todo-list-reorder-sheet";
import {
  StatusFilterTabs,
  type StatusFilter,
} from "@/components/status-filter-tabs";
import { IGNITION } from "@/lib/ignition-palette";

import {
  useDeleteTodo,
  useTodoLists,
  useToggleTodo,
  useTodos,
} from "@/lib/api";

/** Which date section an open todo belongs to. Do-date and due-date are treated
 *  INDEPENDENTLY (matching the PWA's today/upcoming views): a todo counts as
 *  due/overdue-today if EITHER date is today-or-past, so a task due next week but
 *  scheduled to do today lands in Today (not Upcoming). Placement uses the
 *  earliest relevant date; a purely-future task is Upcoming, no dates → Someday. */
function bucketOf(t: Todo, today: string): Bucket {
  const dates = [t.dueDate, t.doDate]
    .filter((d): d is string => !!d)
    .map((d) => d.slice(0, 10));
  if (dates.length === 0) return "someday";
  const past = dates.filter((d) => d <= today);
  if (past.length > 0) return past.some((d) => d < today) ? "overdue" : "today";
  return "upcoming";
}

type Bucket = "overdue" | "today" | "upcoming" | "someday";
const BUCKET_ORDER: Bucket[] = ["overdue", "today", "upcoming", "someday"];
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  someday: "Someday",
};

/** Range presets for the Upcoming window (days ahead; 0 = All). */
const UPCOMING_PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "All", days: 0 },
];

/**
 * Flat, typed row model for the virtualized list. The screen's date-bucketed
 * sections (Overdue/Today/Upcoming/Someday + Completed), the Upcoming range
 * presets, and the empty/loading/error surfaces all become FlashList rows so
 * only the visible slice mounts — previously EVERY todo mounted at once
 * inside a plain ScrollView.
 */
type ListRow =
  | { key: string; type: "banner" }
  | { key: string; type: "skeleton" }
  | { key: string; type: "empty"; variant: "all" | "filtered" }
  | {
      key: string;
      type: "sectionHeader";
      label: string;
      count: number;
      destructive?: boolean;
    }
  | { key: string; type: "presets" }
  | { key: string; type: "windowEmpty" }
  | { key: string; type: "dateLabel"; date: string }
  | { key: string; type: "todo"; todo: Todo };

/**
 * One todo row — reused by the flat buckets, the grouped Upcoming view, and
 * the Completed section. Swipe LEFT reveals a Delete panel (iOS-Mail style:
 * a long swipe deletes immediately via autoCommit) — the mobile-reachable
 * delete affordance the shared TodoItem's hover-delete never gave on touch.
 *
 * PERF: memoized at module level with per-todo-STABLE callbacks from the
 * screen (`onToggleTodo(todo)` etc., not fresh closures per render). The
 * screen re-renders on every sheet open/close and filter tap; without the
 * memo every SwipeableRow + TodoItem re-rendered on the same JS frame the
 * create/edit sheet starts its slide — the single biggest source of the
 * FAB-tap jank. React Query's structural sharing keeps unchanged `todo`
 * objects referentially identical, so the shallow compare bails per-row.
 */
const TodoRow = memo(function TodoRow({
  todo,
  listName,
  listColor,
  onToggleTodo,
  onDeleteTodo,
  onOpenEdit,
}: {
  todo: Todo;
  listName?: string;
  listColor?: string;
  onToggleTodo: (todo: Todo) => void;
  onDeleteTodo: (id: string) => void;
  onOpenEdit: (todo: Todo) => void;
}) {
  const isDone = todo.status === "done";
  return (
    <SwipeableRow
      // Swipe RIGHT — the quick action: complete an open todo (or reopen a
      // done one) in one gesture, iOS-Mail style. A long swipe commits
      // immediately via autoCommit; a short swipe reveals the tappable panel.
      leftActions={[
        {
          label: isDone ? "Reopen" : "Done",
          color: isDone ? "#6b7280" : "#16a34a",
          icon: isDone ? (
            <RotateCcw size={18} color="#ffffff" />
          ) : (
            <Check size={18} color="#ffffff" />
          ),
          onPress: () => onToggleTodo(todo),
          autoCommit: true,
        },
      ]}
      rightActions={[
        {
          label: "Delete",
          color: "#e7000b",
          icon: <Trash2 size={18} color="#ffffff" />,
          onPress: () => onDeleteTodo(todo.id),
          autoCommit: true,
        },
      ]}
    >
      <TodoItem
        todo={todo}
        listName={listName}
        listColor={listColor}
        onToggle={() => onToggleTodo(todo)}
        onDelete={() => onDeleteTodo(todo.id)}
        onOpenDetail={() => onOpenEdit(todo)}
      />
    </SwipeableRow>
  );
});

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const todosQuery = useTodos();
  const listsQuery = useTodoLists();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The row tapped for editing, and a separate open flag. Splitting them lets
  // `editing` stay populated while the sheet animates closed (so the form keeps
  // its values through the exit) — it's replaced, not cleared, the next time a
  // row is opened. A single `editing !== null` gate would unmount instantly and
  // skip the exit animation.
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // List filter — null = All. Filtering is client-side over the one
  // all-todos cache (cheap at mobile scale; no per-list refetch churn).
  const [activeListId, setActiveListId] = useState<string | null>(null);
  // Status filter — "all" shows open + completed; "todo" hides completed;
  // "done" shows only completed (mirrors the habits screen filter).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // List sheet — false = closed, null = create, a list = edit.
  const [listSheet, setListSheet] = useState<false | null | TodoList>(false);
  // Reorder sheet.
  const [reorderOpen, setReorderOpen] = useState(false);
  // Upcoming range window (days ahead; 0 = All). Mirrors the PWA's preset row.
  const [upcomingRange, setUpcomingRange] = useState(7);

  // Stable — feeds RefreshControl and the memoized renderRow.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([todosQuery.refetch(), listsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
    // refetch fns are referentially stable in RQ v5.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosQuery.refetch, listsQuery.refetch]);

  const lists = listsQuery.data ?? [];
  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const todos = useMemo(() => {
    const all = todosQuery.data ?? [];
    return activeListId ? all.filter((t) => t.listId === activeListId) : all;
  }, [todosQuery.data, activeListId]);

  const today = format(new Date(), "yyyy-MM-dd");
  // Completed section windows to the last 7 days (PWA parity — otherwise it
  // grows unbounded). Older completions still live in the list-scoped views.
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  // Show each todo's list badge only in the mixed "All" view (redundant when
  // the rail is already filtered to a single list).
  const showListBadge = activeListId === null && lists.length > 1;

  // Open todos bucketed by date (Overdue/Today/Upcoming/Someday), completed
  // after. Within a group, newest updates float up so a just-completed item
  // is easy to find / undo.
  const { buckets, done } = useMemo(() => {
    const byUpdated = (a: Todo, b: Todo) =>
      b.updatedAt.localeCompare(a.updatedAt);
    const d: Todo[] = [];
    const b: Record<Bucket, Todo[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      someday: [],
    };
    for (const t of todos) {
      if (t.status === "done") {
        const when = (t.completedAt ?? t.updatedAt).slice(0, 10);
        if (when >= sevenDaysAgo) d.push(t);
      } else b[bucketOf(t, today)].push(t);
    }
    for (const k of BUCKET_ORDER) b[k].sort(byUpdated);
    return { buckets: b, done: d.sort(byUpdated) };
  }, [todos, today, sevenDaysAgo]);

  // Upcoming bucket → grouped by earliest future date, windowed by the range
  // preset (shared with the PWA's upcoming view). Other buckets stay flat.
  const upcomingGroups = useMemo(
    () => groupUpcomingByDate(buckets.upcoming, today, upcomingRange),
    [buckets.upcoming, today, upcomingRange],
  );
  const upcomingShown = useMemo(
    () => upcomingGroups.reduce((n, g) => n + g.todos.length, 0),
    [upcomingGroups],
  );

  const activeList = activeListId
    ? (lists.find((l) => l.id === activeListId) ?? null)
    : null;

  // Stable per-screen callbacks for the memoized TodoRow — RQ v5's `mutate`
  // is referentially stable, so these never change identity and rows only
  // re-render when their own `todo` object does.
  const handleToggleTodo = useCallback(
    (todo: Todo) => toggleTodo.mutate({ id: todo.id, status: todo.status }),
    [toggleTodo.mutate],
  );
  const handleDeleteTodo = useCallback(
    (id: string) => deleteTodo.mutate(id),
    [deleteTodo.mutate],
  );

  // Open a row for editing — seed the content and flip the sheet open.
  const handleOpenEdit = useCallback((todo: Todo) => {
    setEditing(todo);
    setEditOpen(true);
  }, []);

  function renderTodo(todo: Todo) {
    return (
      <TodoRow
        // The per-todo key is CORRECTNESS, not style: FlashList recycles cell
        // component instances, and ReanimatedSwipeable keeps its swipe offset
        // in internal shared values — without the key a half-swiped row would
        // be recycled into a DIFFERENT todo with its panel already open. The
        // key forces a remount when the cell is reused (a deliberate trade of
        // some recycling efficiency for correct swipe state).
        key={todo.id}
        todo={todo}
        listName={showListBadge ? listMap.get(todo.listId)?.name : undefined}
        listColor={showListBadge ? listMap.get(todo.listId)?.color : undefined}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onOpenEdit={handleOpenEdit}
      />
    );
  }

  // On close, only flip the open flag — `editing` stays so the sheet keeps its
  // content through the exit animation (replaced on the next open).
  function handleEditOpenChange(next: boolean) {
    setEditOpen(next);
  }

  const isEmpty =
    !todosQuery.isLoading && !todosQuery.error && todos.length === 0;

  // Status filter gating: "todo" hides the completed section, "done" hides the
  // open buckets, "all" shows both.
  const showOpen = statusFilter !== "done";
  const showDone = statusFilter !== "todo";
  const openCount = BUCKET_ORDER.reduce((n, b) => n + buckets[b].length, 0);
  // Todos exist, but the active filter side is empty (e.g. "Done" with no
  // completed todos). Distinct from the all-empty EmptyState above.
  const filteredEmpty =
    !isEmpty &&
    !todosQuery.isLoading &&
    ((statusFilter === "todo" && openCount === 0) ||
      (statusFilter === "done" && done.length === 0));

  // Flatten the bucketed view into the FlashList row model. Recomputes only
  // when the underlying data/filters change — scrolling never rebuilds it.
  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    if (todosQuery.error) out.push({ key: "banner", type: "banner" });
    if (todosQuery.isLoading && todos.length === 0) {
      out.push({ key: "skeleton", type: "skeleton" });
      return out;
    }
    if (isEmpty) {
      out.push({ key: "empty", type: "empty", variant: "all" });
      return out;
    }
    if (filteredEmpty) {
      out.push({ key: "filtered-empty", type: "empty", variant: "filtered" });
    }
    if (showOpen) {
      for (const bucket of BUCKET_ORDER) {
        if (buckets[bucket].length === 0) continue;
        if (bucket === "upcoming") {
          out.push({
            key: "h-upcoming",
            type: "sectionHeader",
            label: "Upcoming",
            count: upcomingShown,
          });
          out.push({ key: "presets", type: "presets" });
          if (upcomingGroups.length === 0) {
            out.push({ key: "window-empty", type: "windowEmpty" });
          } else {
            for (const group of upcomingGroups) {
              out.push({
                key: `d-${group.date}`,
                type: "dateLabel",
                date: group.date,
              });
              for (const todo of group.todos) {
                out.push({ key: todo.id, type: "todo", todo });
              }
            }
          }
          continue;
        }
        out.push({
          key: `h-${bucket}`,
          type: "sectionHeader",
          label: BUCKET_LABEL[bucket],
          count: buckets[bucket].length,
          destructive: bucket === "overdue",
        });
        for (const todo of buckets[bucket]) {
          out.push({ key: todo.id, type: "todo", todo });
        }
      }
    }
    if (showDone && done.length > 0) {
      out.push({
        key: "h-done",
        type: "sectionHeader",
        label: "Completed",
        count: done.length,
      });
      for (const todo of done) {
        out.push({ key: todo.id, type: "todo", todo });
      }
    }
    return out;
  }, [
    todosQuery.error,
    todosQuery.isLoading,
    todos.length,
    isEmpty,
    filteredEmpty,
    showOpen,
    showDone,
    buckets,
    upcomingGroups,
    upcomingShown,
    done,
  ]);

  const rowKey = useCallback((r: ListRow) => r.key, []);
  const rowType = useCallback((r: ListRow) => r.type, []);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<ListRow>) => {
      switch (item.type) {
        case "banner":
          return (
            <View pb="$2">
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load todos</Banner.Title>
                  <Banner.Description>
                    {(todosQuery.error as Error | null)?.message ??
                      "Network error."}
                  </Banner.Description>
                  <Banner.Action self="flex-end" mt="$2">
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={handleRefresh}
                    >
                      Try again
                    </Button>
                  </Banner.Action>
                </Banner.Body>
              </Banner>
            </View>
          );
        case "skeleton":
          // Row-shaped shimmer (shared with the PWA) — first paint already
          // has the list's silhouette.
          return <TodoListSkeleton />;
        case "empty":
          return item.variant === "all" ? (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text fontSize={28}>✓</Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>Nothing to do</EmptyState.Title>
              <EmptyState.Description>
                Tap the + button to capture your first todo — title, priority,
                and dates.
              </EmptyState.Description>
            </EmptyState>
          ) : (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text fontSize={28}>{statusFilter === "done" ? "◎" : "✓"}</Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>
                {statusFilter === "done"
                  ? "Nothing completed yet"
                  : "All caught up"}
              </EmptyState.Title>
              <EmptyState.Description>
                {statusFilter === "done"
                  ? "Completed todos will show up here."
                  : "No open todos — nice work."}
              </EmptyState.Description>
            </EmptyState>
          );
        case "sectionHeader":
          return (
            <XStack items="center" gap="$2" px="$2.5" pt="$3" pb="$2">
              <Text
                fontSize="$1"
                fontWeight="600"
                color={item.destructive ? "$destructive" : "$mutedForeground"}
                letterSpacing={0.6}
                textTransform="uppercase"
              >
                {item.label} · {item.count}
              </Text>
              <View flex={1}>
                <Separator />
              </View>
            </XStack>
          );
        case "presets":
          // Range presets — 7 / 14 / 30 days / All.
          return (
            <XStack gap="$1.5" flexWrap="wrap" px="$1" pb="$2">
              {UPCOMING_PRESETS.map((p) => (
                <Pill
                  key={p.days}
                  size="sm"
                  selected={upcomingRange === p.days}
                  onPress={() => setUpcomingRange(p.days)}
                >
                  {p.label}
                </Pill>
              ))}
            </XStack>
          );
        case "windowEmpty":
          return (
            <Text fontSize="$2" color="$mutedForeground" px="$2.5" py="$1">
              Nothing in this window — try a wider range.
            </Text>
          );
        case "dateLabel":
          return (
            <Text
              fontSize="$2"
              fontWeight="600"
              color="$color"
              px="$2.5"
              pt="$1"
              pb="$1.5"
            >
              {formatUpcomingLabel(item.date, today)}
            </Text>
          );
        case "todo":
          return <View pb="$2">{renderTodo(item.todo)}</View>;
      }
    },
    // renderTodo closes over stable handlers + listMap/showListBadge; the
    // memoized TodoRow bails per-row when nothing it reads changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      todosQuery.error,
      handleRefresh,
      statusFilter,
      upcomingRange,
      today,
      showListBadge,
      listMap,
      handleToggleTodo,
      handleDeleteTodo,
      handleOpenEdit,
    ],
  );

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack px="$4" pt="$4" gap="$3">
          <Text fontSize="$8" fontWeight="700" color="$color">
            Todos
          </Text>
          {/* Status filter — All / To do / Done. */}
          <StatusFilterTabs
            value={statusFilter}
            onValueChange={setStatusFilter}
          />
        </YStack>

        {/* List chips rail — All · each list (color dot) · pencil-on-active ·
            "+ New". The PWA's sidebar/create-list surface as a chips row. */}
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // RN ScrollView defaults to flexGrow:1 — in this flex column it
          // would split the leftover height with the PullToRefresh scroller,
          // stranding the chips mid-screen. Hug the rail's content height.
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 8,
            alignItems: "center",
          }}
        >
          <Pill
            size="sm"
            selected={activeListId === null}
            onPress={() => setActiveListId(null)}
          >
            All
          </Pill>
          {lists.map((list) => (
            <Pill
              key={list.id}
              size="sm"
              selected={activeListId === list.id}
              onPress={() => setActiveListId(list.id)}
            >
              <XStack items="center" gap="$1.5">
                <View
                  width={8}
                  height={8}
                  rounded={9999}
                  bg={(list.color ?? "#3b82f6") as never}
                />
                <Text fontSize="$2" color="$color">
                  {list.name}
                </Text>
              </XStack>
            </Pill>
          ))}
          {activeList ? (
            <Pill
              size="sm"
              onPress={() => setListSheet(activeList)}
              aria-label={`Edit list ${activeList.name}`}
            >
              <Pencil size={12} color="$mutedForeground" />
            </Pill>
          ) : null}
          <Pill size="sm" onPress={() => setListSheet(null)}>
            <XStack items="center" gap="$1">
              <Plus size={12} color="$mutedForeground" />
              <Text fontSize="$2" color="$mutedForeground">
                New
              </Text>
            </XStack>
          </Pill>
          {lists.filter((l) => !l.isDefault).length > 1 ? (
            <Pill
              size="sm"
              onPress={() => setReorderOpen(true)}
              aria-label="Reorder lists"
            >
              <ListOrdered size={12} color="$mutedForeground" />
            </Pill>
          ) : null}
        </RNScrollView>

        {/* Virtualized list — FlashList mounts only the visible slice
            (previously a plain ScrollView mounted EVERY SwipeableRow at
            once). RefreshControl replaces the kit PullToRefresh scroller;
            bottom padding = clearance for the floating BottomNav capsule. */}
        <View flex={1}>
          <FlashList
            data={rows}
            renderItem={renderRow}
            keyExtractor={rowKey}
            getItemType={rowType}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
            }}
          />
        </View>
      </SafeAreaView>

      {/* Full create — priority, due/do dates, list — in a bottom Sheet, the
          same shared TodoForm the PWA opens. Quick-add above stays for
          title-only capture. todo-red tint, lifted above the capsule. */}
      <CreateFab
        label="New todo"
        tint={IGNITION.todo.base}
        onPress={() => setCreateOpen(true)}
      />

      <CreateTodoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        // When a list filter is active, new todos land in that list.
        listId={activeListId ?? undefined}
      />

      {/* Create / edit a list — shared TodoListForm in a FormSheet. */}
      <TodoListSheet
        open={listSheet !== false}
        onOpenChange={(next) => {
          if (!next) setListSheet(false);
        }}
        list={listSheet === false ? null : listSheet}
        onDeleted={(id) => {
          if (activeListId === id) setActiveListId(null);
        }}
      />

      {/* Edit — tapping a row seeds this with the todo; same shared TodoForm
          as create, in a bottom Sheet. `editOpen` drives visibility while
          `editing` holds the content through the close animation. */}
      <EditTodoDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        todo={editing}
      />

      {/* Reorder lists — vertical drag sheet; only shown when 2+ custom
          lists exist (the trigger pill is hidden otherwise). */}
      <TodoListReorderSheet
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        lists={lists}
      />
    </YStack>
  );
}
