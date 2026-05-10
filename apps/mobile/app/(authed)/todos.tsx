// apps/mobile/app/(authed)/todos.tsx
//
// Full Todos screen. Three views via SegmentedControl:
//   - Today: due today OR completed today OR no due date but created today
//   - Upcoming: due tomorrow or later, not done
//   - Done: completed (any time)
//
// FAB → AddTodoSheet for quick capture. Swipe a row right for "Done",
// swipe left for "Delete". Tap the checkbox for the same toggle.

import {
  EmptyState,
  FAB,
  H3,
  Paragraph,
  SegmentedControl,
  Separator,
  Text,
  YStack,
} from "@stageholder/ui";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddTodoSheet } from "@/components/todos/AddTodoSheet";
import { TodoRow } from "@/components/todos/TodoRow";
import { useTodos } from "@/lib/stores/todos";
import { dateKey } from "@/lib/types";

type View = "today" | "upcoming" | "done";

export default function TodosScreen() {
  const [view, setView] = useState<View>("today");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { todos, add, toggle, remove } = useTodos();

  const today = dateKey();

  const filtered = useMemo(() => {
    return todos.filter((t) => {
      const isDone = !!t.completedAt;
      if (view === "done") return isDone;
      if (isDone) {
        // Today's view shows things you finished today, alongside open ones.
        if (view === "today") {
          return dateKey(new Date(t.completedAt!)) === today;
        }
        return false;
      }
      if (view === "today") {
        if (t.dueDate === today) return true;
        if (!t.dueDate && dateKey(new Date(t.createdAt)) === today) return true;
        return false;
      }
      // upcoming
      if (!t.dueDate) return false;
      return t.dueDate > today;
    });
  }, [todos, view, today]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Open first, then by priority desc, then by due date asc.
      const aDone = !!a.completedAt;
      const bDone = !!b.completedAt;
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
        !x.completedAt &&
        (x.dueDate === today ||
          (!x.dueDate && dateKey(new Date(x.createdAt)) === today)),
    ).length;
    const u = todos.filter(
      (x) => !x.completedAt && x.dueDate && x.dueDate > today,
    ).length;
    const d = todos.filter((x) => !!x.completedAt).length;
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
        </YStack>

        <ScrollView
          style={{ flex: 1, marginTop: 16 }}
          contentContainerStyle={{ paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          {sorted.length === 0 ? (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text fontSize={24}>{view === "done" ? "✓" : "◐"}</Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>
                {view === "today"
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
            sorted.map((t, i) => (
              <YStack key={t.id}>
                {i > 0 ? <Separator /> : null}
                <TodoRow todo={t} onToggle={toggle} onDelete={remove} />
              </YStack>
            ))
          )}
        </ScrollView>
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

      <AddTodoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(input) => add(input)}
      />
    </YStack>
  );
}

function priorityRank(p: "low" | "normal" | "high"): number {
  return p === "high" ? 2 : p === "normal" ? 1 : 0;
}
