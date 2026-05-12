// apps/mobile/app/(authed)/todos.tsx
//
// Two-axis filtering:
//
//   1. LIST  — horizontal chip row (Inbox / user lists / All). Only shown
//              when the user has >1 list; otherwise hidden as dead weight.
//   2. TIME  — SegmentedControl (Today / Later / Inbox / Done). Labels
//              kept short so they don't wrap in the narrow segments.
//
// "Inbox" appears in BOTH axes intentionally:
//   - As a list chip: filter to the Inbox list only.
//   - As a time segment: show no-due-date, no-do-date todos (regardless
//     of which list they're in).
//
// Each time segment groups results by date sections — "Today",
// "Tomorrow", "This week", "Later". Inside a group, sort by priority
// then due date.
//
// The redesigned TodoRow handles its own ignition animation when checked;
// the screen just hands it the data + a tap handler that opens the
// detail sheet.

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  PullToRefresh,
  Progress,
  SegmentedControl,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Todo, TodoList } from "@repo/core/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android — iOS has it on by default. Idempotent;
// no-op on subsequent calls.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// How long the row holds its open-list position after being checked.
// Matches the TodoFireBurst duration so the burst can finish playing
// before the row exits its current spot.
const CELEBRATION_HOLD_MS = 760;

import { AddTodoSheet } from "@/components/todos/AddTodoSheet";
import { ListChips } from "@/components/todos/ListChips";
import { TodoDetailSheet } from "@/components/todos/TodoDetailSheet";
import { TodoRow } from "@/components/todos/TodoRow";
import { useTodoLists, useTodos } from "@/lib/api";
import { fromDateKey, localDateKey } from "@/lib/streak";

type View = "today" | "later" | "inbox" | "done";

export default function TodosScreen() {
  const [view, setView] = useState<View>("today");
  const [listFilter, setListFilter] = useState<string | null>(null); // null = All
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // IDs of todos whose celebration is still playing. While an id is in
  // this set, the row is treated as "still open" for sort + filter so
  // the fire burst can play where the user tapped instead of chasing
  // the row to the bottom of the list. After CELEBRATION_HOLD_MS we
  // drop the id and trigger a LayoutAnimation so the row slides into
  // its real done-position smoothly.
  const [completingIds, setCompletingIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleCelebrate = useCallback((todo: Todo) => {
    setCompletingIds((prev) => {
      if (prev.has(todo.id)) return prev;
      const next = new Set(prev);
      next.add(todo.id);
      return next;
    });
    setTimeout(() => {
      LayoutAnimation.configureNext({
        duration: 320,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      setCompletingIds((prev) => {
        if (!prev.has(todo.id)) return prev;
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }, CELEBRATION_HOLD_MS);
  }, []);

  // Cancel any pending settles on unmount so we don't call setState on
  // an unmounted screen if the user navigates mid-celebration.
  useEffect(() => () => setCompletingIds(new Set()), []);

  /**
   * Returns the status to use for sort/filter purposes. A todo that's in
   * the celebrating set reads as "todo" even though the optimistic data
   * already says "done" — that holds the row in place during the burst.
   */
  const effectiveStatus = useCallback(
    (t: Todo): Todo["status"] => (completingIds.has(t.id) ? "todo" : t.status),
    [completingIds],
  );

  const todosQuery = useTodos();
  const listsQuery = useTodoLists();
  const todos = todosQuery.data ?? [];
  const lists = listsQuery.data ?? [];
  const listById = useMemo(
    () =>
      Object.fromEntries(lists.map((l) => [l.id, l])) as Record<
        string,
        TodoList
      >,
    [lists],
  );

  const today = localDateKey();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await todosQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  // Look up the selected todo by id so optimistic updates in the detail
  // sheet's mutations re-render the sheet without manual state copies.
  const detailTodo = useMemo(
    () => (detailId ? (todos.find((t) => t.id === detailId) ?? null) : null),
    [detailId, todos],
  );

  // -------- list-axis filter ----------
  const byList = useMemo(() => {
    if (listFilter == null) return todos;
    return todos.filter((t) => t.listId === listFilter);
  }, [todos, listFilter]);

  // -------- time-axis filter ----------
  const filtered = useMemo(() => {
    return byList.filter((t) => {
      // effectiveStatus pretends celebrating todos are still "todo" so
      // they stay visible (in their open position) for the burst.
      const isDone = effectiveStatus(t) === "done";
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
      if (view === "inbox") {
        return !t.dueDate && !t.doDate;
      }
      // later
      if (!t.dueDate) return false;
      return t.dueDate > today;
    });
  }, [byList, view, today, effectiveStatus]);

  // For "later" view, group by date buckets for scannable structure.
  const grouped = useMemo(() => {
    if (view !== "later") return null;
    const now = new Date();
    const tomorrowKey = (() => {
      const d = new Date(now);
      d.setDate(now.getDate() + 1);
      return localDateKey(d);
    })();
    const weekEnd = (() => {
      const d = new Date(now);
      d.setDate(now.getDate() + 7);
      return localDateKey(d);
    })();

    const buckets: { label: string; items: Todo[] }[] = [
      { label: "Tomorrow", items: [] },
      { label: "This week", items: [] },
      { label: "Later", items: [] },
    ];
    for (const t of filtered) {
      const k = t.dueDate ?? "9999-99-99";
      if (k === tomorrowKey) buckets[0]!.items.push(t);
      else if (k <= weekEnd) buckets[1]!.items.push(t);
      else buckets[2]!.items.push(t);
    }
    return buckets.filter((b) => b.items.length > 0);
  }, [view, filtered]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Same effectiveStatus dodge — a celebrating row's done flag is
      // ignored so it stays where it was when the user tapped.
      const aDone = effectiveStatus(a) === "done";
      const bDone = effectiveStatus(b) === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const pri = priorityRank(b.priority) - priorityRank(a.priority);
      if (pri !== 0) return pri;
      const aDue = a.dueDate ?? "9999-99-99";
      const bDue = b.dueDate ?? "9999-99-99";
      return aDue.localeCompare(bDue);
    });
  }, [filtered, effectiveStatus]);

  // Counts feeding the segmented control + list chips.
  const todayOpen = todos.filter(
    (x) =>
      x.status !== "done" &&
      (x.dueDate === today ||
        x.doDate === today ||
        (!x.dueDate && x.createdAt.slice(0, 10) === today)),
  );
  const todayDone = todos.filter(
    (x) => x.status === "done" && x.updatedAt.slice(0, 10) === today,
  );
  const counts = useMemo(() => {
    const open = byList.filter((x) => x.status !== "done");
    const t = byList.filter(
      (x) =>
        x.status !== "done" &&
        (x.dueDate === today ||
          x.doDate === today ||
          (!x.dueDate && x.createdAt.slice(0, 10) === today)),
    ).length;
    const l = open.filter((x) => x.dueDate && x.dueDate > today).length;
    const i = open.filter((x) => !x.dueDate && !x.doDate).length;
    const d = byList.filter((x) => x.status === "done").length;
    return { today: t, later: l, inbox: i, done: d };
  }, [byList, today]);

  const listCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of todos) {
      if (t.status === "done") continue;
      out[t.listId] = (out[t.listId] ?? 0) + 1;
    }
    return out;
  }, [todos]);

  // Today completion ratio — drives the small ignition progress bar at top.
  const todayTotal = todayOpen.length + todayDone.length;
  const todayPct =
    todayTotal === 0 ? 0 : Math.round((todayDone.length / todayTotal) * 100);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack gap="$3" pt="$4" px="$5">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={2}
              textTransform="uppercase"
              color="$color11"
              fontWeight="600"
            >
              {todayTotal === 0
                ? "Nothing on the table"
                : `${todayDone.length} of ${todayTotal} lit today`}
            </Paragraph>
            <H3 color="$color12">Todos</H3>
          </YStack>

          {/* Daily ignition progress — visible only when there's something
              to track. The bar fills in the priority-fire palette as the
              user works through their day. */}
          {todayTotal > 0 ? (
            <YStack gap={4}>
              <Progress value={todayPct}>
                <Progress.Indicator />
              </Progress>
            </YStack>
          ) : null}

          {/* TIME-axis filter. Short labels keep the 4-segment bar readable
              on the narrowest phones — see SegmentedControl numberOfLines=1
              fix in @stageholder/ui. */}
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as View)}
            fullWidth
          >
            <SegmentedControl.Item value="today">
              Today{counts.today > 0 ? ` ${counts.today}` : ""}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="later">
              Later{counts.later > 0 ? ` ${counts.later}` : ""}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="inbox">
              Inbox{counts.inbox > 0 ? ` ${counts.inbox}` : ""}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="done">Done</SegmentedControl.Item>
          </SegmentedControl>
        </YStack>

        {/* LIST-axis filter — horizontal chip row. Sits OUTSIDE the
            padded YStack so the ScrollView can bleed to the screen edges. */}
        <YStack mt="$3">
          <ListChips
            lists={lists}
            value={listFilter}
            onChange={setListFilter}
            counts={listCounts}
          />
        </YStack>

        {todosQuery.error ? (
          <YStack px="$5" mt="$3">
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
          </YStack>
        ) : null}

        <YStack flex={1} mt="$2">
          <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
            <YStack pb={120}>
              {sorted.length === 0 ? (
                <EmptyState>
                  <EmptyState.IconSlot>
                    <Text fontSize={32}>
                      {view === "done"
                        ? "✓"
                        : view === "inbox"
                          ? "✦"
                          : view === "later"
                            ? "◌"
                            : "◐"}
                    </Text>
                  </EmptyState.IconSlot>
                  <EmptyState.Title>
                    {todosQuery.isLoading
                      ? "Loading…"
                      : view === "today"
                        ? "Nothing lit for today"
                        : view === "later"
                          ? "Clear road ahead"
                          : view === "inbox"
                            ? "Inbox is empty"
                            : "No stars yet"}
                  </EmptyState.Title>
                  <EmptyState.Description>
                    {view === "today"
                      ? "Tap + to add the first thing you want to handle today."
                      : view === "later"
                        ? "Schedule a due date and it'll show up here."
                        : view === "inbox"
                          ? "Quick captures without a date land here. Add one with +."
                          : "Done items live here. Complete a todo to see it."}
                  </EmptyState.Description>
                </EmptyState>
              ) : grouped ? (
                // Date-grouped "Later" view.
                grouped.map((bucket) => (
                  <YStack key={bucket.label} gap="$1" mt="$3">
                    <Text
                      px="$5"
                      fontFamily="$mono"
                      fontSize={10}
                      letterSpacing={1.6}
                      textTransform="uppercase"
                      color="$color11"
                      fontWeight="600"
                    >
                      {bucket.label} · {bucket.items.length}
                    </Text>
                    {bucket.items
                      .sort((a, b) => {
                        const pri =
                          priorityRank(b.priority) - priorityRank(a.priority);
                        if (pri !== 0) return pri;
                        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
                      })
                      .map((t) => (
                        <TodoRow
                          key={t.id}
                          todo={t}
                          list={listFilter == null ? listById[t.listId] : null}
                          completing={completingIds.has(t.id)}
                          onCelebrate={handleCelebrate}
                          onPress={() => setDetailId(t.id)}
                        />
                      ))}
                  </YStack>
                ))
              ) : (
                <YStack gap="$1" mt="$2">
                  {sorted.map((t: Todo) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      list={listFilter == null ? listById[t.listId] : null}
                      completing={completingIds.has(t.id)}
                      onCelebrate={handleCelebrate}
                      onPress={() => setDetailId(t.id)}
                    />
                  ))}
                </YStack>
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
        onPress={() => setAddOpen(true)}
      />

      <AddTodoSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        // If the user is currently filtered to a list, the new todo lands
        // there by default — match the user's mental context.
        defaultListId={listFilter ?? undefined}
      />
      <TodoDetailSheet
        open={!!detailTodo}
        todo={detailTodo}
        onClose={() => setDetailId(null)}
      />
    </YStack>
  );
}

// Silence unused-import warning on the date helper used in groupings.
void fromDateKey;

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
