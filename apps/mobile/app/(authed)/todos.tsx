// apps/mobile/app/(authed)/todos.tsx
//
// Three views via SegmentedControl: Today / Upcoming / Done. Pulls live
// data from useTodos and filters client-side — keeps the API simple
// (one endpoint, all the filtering knobs are local).
//
// Mobile UX:
//   - Pull-to-refresh hands off to React Query's refetch
//   - Error banner with retry surfaces above the list on query failure
//   - Optimistic toggle/delete via the API layer means the UI is instant
//   - FAB → AddTodoSheet for quick capture, above the tab bar

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  PullToRefresh,
  SegmentedControl,
  Separator,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddTodoSheet } from "@/components/todos/AddTodoSheet";
import { TodoRow } from "@/components/todos/TodoRow";
import { useTodos } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

type View = "today" | "upcoming" | "done";

export default function TodosScreen() {
  const [view, setView] = useState<View>("today");
  const [sheetOpen, setSheetOpen] = useState(false);
  const todosQuery = useTodos();
  const [refreshing, setRefreshing] = useState(false);

  const today = localDateKey();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await todosQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const todos = todosQuery.data ?? [];

  const filtered = useMemo(() => {
    return todos.filter((t) => {
      const isDone = t.status === "done";
      if (view === "done") return isDone;
      if (isDone) {
        if (view === "today") return t.updatedAt.slice(0, 10) === today;
        return false;
      }
      if (view === "today") {
        if (t.dueDate === today) return true;
        if (t.doDate === today) return true;
        if (!t.dueDate && t.createdAt.slice(0, 10) === today) return true;
        return false;
      }
      if (!t.dueDate) return false;
      return t.dueDate > today;
    });
  }, [todos, view, today]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDone = a.status === "done";
      const bDone = b.status === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const pri = priorityRank(b.priority) - priorityRank(a.priority);
      if (pri !== 0) return pri;
      const aDue = a.dueDate ?? "9999-99-99";
      const bDue = b.dueDate ?? "9999-99-99";
      return aDue.localeCompare(bDue);
    });
  }, [filtered]);

  const counts = useMemo(() => {
    const t = todos.filter(
      (x) =>
        x.status !== "done" &&
        (x.dueDate === today ||
          x.doDate === today ||
          (!x.dueDate && x.createdAt.slice(0, 10) === today)),
    ).length;
    const u = todos.filter(
      (x) => x.status !== "done" && x.dueDate && x.dueDate > today,
    ).length;
    const d = todos.filter((x) => x.status === "done").length;
    return { today: t, upcoming: u, done: d };
  }, [todos, today]);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack gap="$4" pt="$4" px="$5">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={11}
              letterSpacing={2}
              textTransform="uppercase"
              color="$color11"
            >
              Inbox · upcoming · done
            </Paragraph>
            <H3 color="$color12">Todos</H3>
          </YStack>

          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as View)}
            fullWidth
          >
            <SegmentedControl.Item value="today">
              Today {counts.today > 0 ? `(${counts.today})` : ""}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="upcoming">
              Upcoming {counts.upcoming > 0 ? `(${counts.upcoming})` : ""}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="done">Done</SegmentedControl.Item>
          </SegmentedControl>

          {todosQuery.error ? (
            <Banner intent="danger">
              <Banner.Title>Couldn't load todos</Banner.Title>
              <Banner.Description>
                {(todosQuery.error as Error).message ?? "Network error."}
              </Banner.Description>
              <XStack pt="$2">
                <Button intent="secondary" size="$2" onPress={handleRefresh}>
                  Try again
                </Button>
              </XStack>
            </Banner>
          ) : null}
        </YStack>

        <YStack flex={1} mt="$3">
          <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
            <YStack pb={96}>
              {sorted.length === 0 ? (
                <EmptyState>
                  <EmptyState.IconSlot>
                    <Text fontSize={24}>{view === "done" ? "✓" : "◐"}</Text>
                  </EmptyState.IconSlot>
                  <EmptyState.Title>
                    {todosQuery.isLoading
                      ? "Loading…"
                      : view === "today"
                        ? "Nothing for today"
                        : view === "upcoming"
                          ? "Clear road ahead"
                          : "Nothing finished yet"}
                  </EmptyState.Title>
                  <EmptyState.Description>
                    {view === "today"
                      ? "Tap + to add the first thing you want to handle today."
                      : view === "upcoming"
                        ? "Schedule something with a due date and it'll show up here."
                        : "Done items live here. Complete a todo to see it."}
                  </EmptyState.Description>
                </EmptyState>
              ) : (
                sorted.map((t: Todo, i) => (
                  <YStack key={t.id}>
                    {i > 0 ? <Separator /> : null}
                    <TodoRow todo={t} />
                  </YStack>
                ))
              )}
            </YStack>
          </PullToRefresh>
        </YStack>
      </SafeAreaView>

      <FAB
        icon={
          <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
            +
          </Text>
        }
        placement="bottom-right"
        b={88}
        onPress={() => setSheetOpen(true)}
      />

      <AddTodoSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </YStack>
  );
}

function priorityRank(p: Todo["priority"]): number {
  return p === "urgent"
    ? 4
    : p === "high"
      ? 3
      : p === "medium"
        ? 2
        : p === "low"
          ? 1
          : 0;
}
