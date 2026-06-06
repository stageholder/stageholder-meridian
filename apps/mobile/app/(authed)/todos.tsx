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
// Grouping is kept trivial: open todos first (the working set), a thin
// "Completed" section after. The web app owns the richer two-axis
// list/time filtering; mobile is a focused capture + complete surface this
// pass. Tapping a row opens the native EditTodoDialog (the same shared
// TodoForm as create, seeded with the row's values); subtasks remain a
// "manage on the web app" concern this pass.

import {
  Banner,
  Button,
  EmptyState,
  PullToRefresh,
  Separator,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { TodoItem } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { CreateFab } from "@/components/create-fab";
import { CreateTodoDialog } from "@/components/create-todo-dialog";
import { EditTodoDialog } from "@/components/edit-todo-dialog";
import { IGNITION } from "@/lib/ignition-palette";

import { useDeleteTodo, useToggleTodo, useTodos } from "@/lib/api";

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const todosQuery = useTodos();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The row tapped for editing. Held even while the sheet animates closed so
  // the form keeps its values through the exit (cleared on full close below).
  const [editing, setEditing] = useState<Todo | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await todosQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const todos = todosQuery.data ?? [];

  // Open first (the working set), completed after. Within a group, newest
  // updates float up so a just-completed item is easy to find / undo.
  const { open, done } = useMemo(() => {
    const o: Todo[] = [];
    const d: Todo[] = [];
    for (const t of todos) (t.status === "done" ? d : o).push(t);
    const byUpdated = (a: Todo, b: Todo) =>
      b.updatedAt.localeCompare(a.updatedAt);
    return { open: o.sort(byUpdated), done: d.sort(byUpdated) };
  }, [todos]);

  function handleEditOpenChange(next: boolean) {
    if (!next) setEditing(null);
  }

  const isEmpty =
    !todosQuery.isLoading && !todosQuery.error && todos.length === 0;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack px="$4" pt="$4" gap="$3">
          <Text fontSize="$8" fontWeight="700" color="$color">
            Todos
          </Text>
        </YStack>

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
                <Banner.Title>Couldn&apos;t load todos</Banner.Title>
                <Banner.Description>
                  {(todosQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
                <Banner.Action>
                  <Button intent="secondary" size="sm" onPress={handleRefresh}>
                    Try again
                  </Button>
                </Banner.Action>
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

            {/* Open todos */}
            {open.map((todo) => (
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

            {/* Completed section */}
            {done.length > 0 ? (
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

      <CreateTodoDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit — tapping a row seeds this with the todo; same shared TodoForm
          as create, in a bottom Sheet. `editing` gates open so the sheet
          mounts only with a real todo to edit. */}
      <EditTodoDialog
        open={editing !== null}
        onOpenChange={handleEditOpenChange}
        todo={editing}
      />
    </YStack>
  );
}
