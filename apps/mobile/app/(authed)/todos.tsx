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
  PullToRefresh,
  Separator,
  SwipeableRow,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { TodoItem, TodoListSkeleton } from "@repo/features/todos";
import {
  formatUpcomingLabel,
  groupUpcomingByDate,
} from "@repo/core/todos/upcoming";
import type { Todo, TodoList } from "@repo/core/types";
import { ListOrdered, Pencil, Plus, Trash2 } from "@tamagui/lucide-icons-2";
import { format, subDays } from "date-fns";
import { memo, useCallback, useMemo, useState } from "react";
import { ScrollView as RNScrollView } from "react-native";
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
  return (
    <SwipeableRow
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

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([todosQuery.refetch(), listsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

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

        {/* PullToRefresh.native is the scroller — its child is the padded
            content column, not a nested ScrollView. */}
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          {/* Bottom padding = clearance for the floating BottomNav capsule
              (PWA shell parity). Lives on the content column — kit
              PullToRefresh (alpha.29) no longer accepts
              contentContainerStyle. */}
          <YStack
            gap="$2"
            px="$4"
            pt="$3"
            pb={BOTTOM_NAV_CLEARANCE + insets.bottom}
          >
            {/* Error */}
            {todosQuery.error ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load todos</Banner.Title>
                  <Banner.Description>
                    {(todosQuery.error as Error).message ?? "Network error."}
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
            ) : null}

            {/* Loading — row-shaped shimmer (shared with the PWA) instead of
                a centered spinner, so the first paint already has the list's
                silhouette. */}
            {todosQuery.isLoading && todos.length === 0 ? (
              <TodoListSkeleton />
            ) : null}

            {/* Empty */}
            {isEmpty ? (
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
            ) : null}

            {/* Filtered-empty — todos exist but none match the active filter. */}
            {filteredEmpty ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={28}>
                    {statusFilter === "done" ? "◎" : "✓"}
                  </Text>
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
            ) : null}

            {/* Open todos — date-bucketed sections (PWA today/upcoming/inbox
                views, stacked). A section renders only when non-empty;
                Overdue's header reads destructive. */}
            {showOpen &&
              BUCKET_ORDER.map((bucket) => {
                if (buckets[bucket].length === 0) return null;

                // Upcoming: a range-preset row + date-grouped sub-sections
                // (Tomorrow / weekday headers), mirroring the PWA upcoming view.
                if (bucket === "upcoming") {
                  return (
                    <YStack key={bucket} gap="$2" pt="$1">
                      <XStack items="center" gap="$2" px="$2.5">
                        <Text
                          fontSize="$1"
                          fontWeight="600"
                          color="$mutedForeground"
                          letterSpacing={0.6}
                          textTransform="uppercase"
                        >
                          Upcoming · {upcomingShown}
                        </Text>
                        <View flex={1}>
                          <Separator />
                        </View>
                      </XStack>

                      {/* Range presets — 7 / 14 / 30 days / All. */}
                      <XStack gap="$1.5" flexWrap="wrap" px="$1">
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

                      {upcomingGroups.length === 0 ? (
                        <Text
                          fontSize="$2"
                          color="$mutedForeground"
                          px="$2.5"
                          py="$1"
                        >
                          Nothing in this window — try a wider range.
                        </Text>
                      ) : (
                        upcomingGroups.map((group) => (
                          <YStack key={group.date} gap="$1.5" pt="$1">
                            <Text
                              fontSize="$2"
                              fontWeight="600"
                              color="$color"
                              px="$2.5"
                            >
                              {formatUpcomingLabel(group.date, today)}
                            </Text>
                            {group.todos.map((todo) => renderTodo(todo))}
                          </YStack>
                        ))
                      )}
                    </YStack>
                  );
                }

                return (
                  <YStack key={bucket} gap="$2" pt="$1">
                    <XStack items="center" gap="$2" px="$2.5">
                      <Text
                        fontSize="$1"
                        fontWeight="600"
                        color={
                          bucket === "overdue"
                            ? "$destructive"
                            : "$mutedForeground"
                        }
                        letterSpacing={0.6}
                        textTransform="uppercase"
                      >
                        {BUCKET_LABEL[bucket]} · {buckets[bucket].length}
                      </Text>
                      <View flex={1}>
                        <Separator />
                      </View>
                    </XStack>
                    {buckets[bucket].map((todo) => renderTodo(todo))}
                  </YStack>
                );
              })}

            {/* Completed section */}
            {showDone && done.length > 0 ? (
              <YStack gap="$2" pt="$2">
                <XStack items="center" gap="$2" px="$2.5">
                  <Text
                    fontSize="$1"
                    fontWeight="600"
                    color="$mutedForeground"
                    letterSpacing={0.6}
                    textTransform="uppercase"
                  >
                    Completed · {done.length}
                  </Text>
                  <View flex={1}>
                    <Separator />
                  </View>
                </XStack>
                {done.map((todo) => renderTodo(todo))}
              </YStack>
            ) : null}
          </YStack>
        </PullToRefresh>
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
