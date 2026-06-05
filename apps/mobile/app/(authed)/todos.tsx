// apps/mobile/app/(authed)/todos.tsx
//
// Todos — the core loop. A list of cross-platform `TodoItem`s (from
// @repo/features) with the toggle-complete + delete mutations wired. A
// quick-add row at the top creates a todo into the user's default list
// (the todos hooks expose `useCreateTodo`, so we surface it rather than
// deferring).
//
// Two create affordances mirror the PWA: the quick-add row captures a
// title-only todo fast, and the FAB opens the full CreateTodoDialog (priority,
// due/do dates, list) as a bottom Sheet — same shared TodoForm the PWA uses.
//
// Grouping is kept trivial: open todos first (the working set), a thin
// "Completed" section after. The web app owns the richer two-axis
// list/time filtering; mobile is a focused capture + complete surface this
// pass. Detail editing of an existing todo (subtasks, etc.) is deferred —
// tapping a row opens the web app for now via a toast.

import {
  Banner,
  Button,
  EmptyState,
  Input,
  PullToRefresh,
  Separator,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { Plus } from "@tamagui/lucide-icons-2";
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
import { IGNITION } from "@/lib/ignition-palette";

import {
  useCreateTodo,
  useDeleteTodo,
  useToggleTodo,
  useTodos,
} from "@/lib/api";

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const todosQuery = useTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const toast = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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

  function handleAdd() {
    const title = draft.trim();
    if (!title || createTodo.isPending) return;
    setDraft("");
    createTodo.mutate(
      { title },
      {
        onError: (err) => {
          // Restore the text so the user doesn't lose their typing on failure.
          setDraft(title);
          toast.show({
            title: "Couldn't add todo",
            message: (err as Error).message ?? "Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  function manageOnWeb() {
    toast.show({
      title: "Edit on the web app",
      message:
        "Priority, due dates, and subtasks are edited on the web app for now.",
      intent: "info",
    });
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

          {/* Quick add — Enter (return key) or the + button commits. */}
          <XStack gap="$2" items="center">
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a todo…"
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <Button
              iconOnly
              icon={<Plus size={18} color="#ffffff" />}
              onPress={handleAdd}
              disabled={!draft.trim() || createTodo.isPending}
              loading={createTodo.isPending}
              aria-label="Add todo"
            />
          </XStack>
        </YStack>

        {/* PullToRefresh.native is the scroller — its child is the padded
            content column, not a nested ScrollView. */}
        <PullToRefresh
          refreshing={refreshing}
          onRefresh={handleRefresh}
          // Clearance for the floating BottomNav capsule (PWA shell parity).
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$2" px="$4" pt="$3" pb="$10">
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
                  Capture the next thing on your mind in the box above, or tap
                  the + button to set priority and dates.
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
                onOpenDetail={manageOnWeb}
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
                    onOpenDetail={manageOnWeb}
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
    </YStack>
  );
}
