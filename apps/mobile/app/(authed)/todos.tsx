// apps/mobile/app/(authed)/todos.tsx
//
// Todos — the core loop. A list of cross-platform `TodoItem`s (from
// @repo/features) with the toggle-complete + delete mutations wired.
//
// Creation is the FAB: it opens the full CreateTodoDialog (priority, due/do
// dates, list) as a bottom Sheet — same shared TodoForm the PWA uses. (The
// old quick-add row above the list was removed — one create affordance, the
// standard mobile pattern.)
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
  Spinner,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { TodoItem } from "@repo/features/todos";
import type { Todo, TodoList } from "@repo/core/types";
import { ListOrdered, Pencil, Plus } from "@tamagui/lucide-icons-2";
import { format } from "date-fns";
import { useMemo, useState } from "react";
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

/** Which date section an open todo belongs to — keyed off dueDate, falling
 *  back to doDate (the PWA's today/upcoming bucketing). */
function bucketOf(t: Todo, today: string): Bucket {
  const d = (t.dueDate ?? t.doDate ?? "").slice(0, 10);
  if (!d) return "someday";
  if (d < today) return "overdue";
  if (d === today) return "today";
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

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const todosQuery = useTodos();
  const listsQuery = useTodoLists();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The row tapped for editing. Held even while the sheet animates closed so
  // the form keeps its values through the exit (cleared on full close below).
  const [editing, setEditing] = useState<Todo | null>(null);
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

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([todosQuery.refetch(), listsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const lists = listsQuery.data ?? [];
  const todos = useMemo(() => {
    const all = todosQuery.data ?? [];
    return activeListId ? all.filter((t) => t.listId === activeListId) : all;
  }, [todosQuery.data, activeListId]);

  const today = format(new Date(), "yyyy-MM-dd");

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
      if (t.status === "done") d.push(t);
      else b[bucketOf(t, today)].push(t);
    }
    for (const k of BUCKET_ORDER) b[k].sort(byUpdated);
    return { buckets: b, done: d.sort(byUpdated) };
  }, [todos, today]);

  const activeList = activeListId
    ? (lists.find((l) => l.id === activeListId) ?? null)
    : null;

  function handleEditOpenChange(next: boolean) {
    if (!next) setEditing(null);
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

            {/* Loading */}
            {todosQuery.isLoading && todos.length === 0 ? (
              <View py="$10" items="center" justify="center">
                <Spinner size="large" />
              </View>
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
              BUCKET_ORDER.map((bucket) =>
                buckets[bucket].length === 0 ? null : (
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
                    {buckets[bucket].map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={() =>
                          toggleTodo.mutate({
                            id: todo.id,
                            status: todo.status,
                          })
                        }
                        onDelete={() => deleteTodo.mutate(todo.id)}
                        onOpenDetail={() => setEditing(todo)}
                      />
                    ))}
                  </YStack>
                ),
              )}

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
                {done.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={() =>
                      toggleTodo.mutate({ id: todo.id, status: todo.status })
                    }
                    onDelete={() => deleteTodo.mutate(todo.id)}
                    onOpenDetail={() => setEditing(todo)}
                  />
                ))}
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
          as create, in a bottom Sheet. `editing` gates open so the sheet
          mounts only with a real todo to edit. */}
      <EditTodoDialog
        open={editing !== null}
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
