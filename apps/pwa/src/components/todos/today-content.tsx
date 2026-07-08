import type { ComponentProps, ReactNode } from "react";
import { format } from "date-fns";
import { Sun } from "lucide-react";
import { AnimatePresence, Text, XStack, YStack } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { CompletedSection } from "./completed-section";
import { TodoListSkeleton } from "@repo/features/todos";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import { todoCompletedAt } from "@/lib/date";
import type { Todo } from "@repo/core/types";

export function TodayContent() {
  const {
    data: todos,
    isLoading: todosLoading,
    isError: todosError,
  } = useAllTodos();
  const {
    data: lists,
    isLoading: listsLoading,
    isError: listsError,
  } = useTodoLists();

  const isLoading = todosLoading || listsLoading;
  const isError = todosError || listsError;

  const today = format(new Date(), "yyyy-MM-dd");

  const dueByToday = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due <= today) || (!!doDate && doDate <= today);
  });

  const isOverdue = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due < today) || (!!doDate && doDate < today);
  };

  const overdue = dueByToday.filter(isOverdue);
  const dueToday = dueByToday.filter((t) => !isOverdue(t));

  // Todos finished today (the satisfying "look what I got done" group).
  const completedToday = (todos || []).filter(
    (t: Todo) =>
      t.status === "done" &&
      format(new Date(todoCompletedAt(t)), "yyyy-MM-dd") === today,
  );

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  // Overdue + Today render as a SINGLE AnimatePresence with interleaved, keyed
  // section headers. A do-date change that moves a todo between the two buckets
  // is then a keyed REORDER (same instance, repositioned) instead of an
  // exit-in-one-list + enter-in-the-other — the latter double-rendered the row
  // and read as a "blink". Headers appear/disappear with presence (no anim);
  // todos keep their enter/exit for genuine add / complete / delete.
  const groups: {
    key: string;
    label: string;
    color: ComponentProps<typeof Text>["color"];
    items: Todo[];
  }[] = [
    { key: "overdue", label: "Overdue", color: "$destructive", items: overdue },
    {
      key: "today",
      label: "Today",
      color: "$mutedForeground",
      items: dueToday,
    },
  ];

  const rows: ReactNode[] = [];
  let firstGroup = true;
  for (const g of groups) {
    if (g.items.length === 0) continue;
    rows.push(
      <XStack
        key={`header-${g.key}`}
        mt={firstGroup ? 0 : "$5"}
        mb="$1.5"
        items="center"
        gap="$2"
      >
        <Text
          fontSize="$1"
          fontWeight="700"
          color={g.color}
          textTransform="uppercase"
          letterSpacing={0.6}
        >
          {g.label}
        </Text>
        <Text fontSize="$1" color="$mutedForeground">
          {g.items.length}
        </Text>
      </XStack>,
    );
    for (const todo of g.items) {
      rows.push(
        <TodoItem key={todo.id} todo={todo} listId={todo.listId} showList />,
      );
    }
    firstGroup = false;
  }

  return (
    <>
      <XStack mb="$6" items="center" gap="$3">
        <Text color="$mutedForeground" lineHeight={0}>
          <Sun size={24} />
        </Text>
        <YStack>
          <Text fontSize="$7" fontWeight="700" color="$color">
            Today
          </Text>
          <Text mt="$1" fontSize="$3" color="$mutedForeground">
            {dueByToday.length} due today or overdue
          </Text>
        </YStack>
      </XStack>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <TodoListSkeleton />
      ) : isError ? (
        <Text mt="$3" fontSize="$3" color="$destructive">
          Failed to load todos. Please try refreshing the page.
        </Text>
      ) : (
        <YStack mt="$4" gap="$6">
          {dueByToday.length === 0 ? (
            <YStack py="$8" items="center">
              <Text fontSize="$3" color="$mutedForeground" text="center">
                Nothing due today. You&apos;re all caught up!
              </Text>
            </YStack>
          ) : (
            <YStack gap="$0.5">
              <AnimatePresence>{rows}</AnimatePresence>
            </YStack>
          )}
          <CompletedSection todos={completedToday} />
        </YStack>
      )}
    </>
  );
}
