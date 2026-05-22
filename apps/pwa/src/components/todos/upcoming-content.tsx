import { useState } from "react";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import { useAnimatedTodoList } from "@/lib/hooks/use-animated-todo-list";
import {
  Button,
  Calendar,
  Popover,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { format, addDays } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import type { DateRange } from "react-day-picker";
import type { Todo, TodoList } from "@repo/core/types";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "All", days: 0 },
] as const;

export function UpcomingContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [customOpen, setCustomOpen] = useState(false);

  const isLoading = todosLoading || listsLoading;

  const today = format(new Date(), "yyyy-MM-dd");

  const hasCustomRange = customRange?.from != null;
  const customFrom = customRange?.from
    ? format(customRange.from, "yyyy-MM-dd")
    : null;
  const customTo = customRange?.to
    ? format(customRange.to, "yyyy-MM-dd")
    : null;

  // Compute filter bounds
  const rangeStart = hasCustomRange && customFrom ? customFrom : today;
  const rangeEnd =
    hasCustomRange && customTo
      ? customTo
      : hasCustomRange && customFrom
        ? customFrom
        : selectedDays > 0
          ? format(addDays(new Date(), selectedDays), "yyyy-MM-dd")
          : null; // null = show all

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const upcomingTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    // Exclude todos already in "today" (due today or overdue)
    const isDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const isDoToday = doDateStr !== undefined && doDateStr <= today;
    if (isDueToday || isDoToday) return false;
    // Include todos with a future date
    const hasFutureDue = dueDateStr !== undefined && dueDateStr > today;
    const hasFutureDo = doDateStr !== undefined && doDateStr > today;
    if (!(hasFutureDue || hasFutureDo)) return false;
    // Apply date range filter
    const earliestDate = getEarliestDate(t, today);
    if (hasCustomRange) {
      if (rangeStart && earliestDate < rangeStart) return false;
      if (rangeEnd && earliestDate > rangeEnd) return false;
    } else if (rangeEnd) {
      if (earliestDate > rangeEnd) return false;
    }
    return true;
  });

  const { visibleTodos: animatedUpcoming, completingIds } =
    useAnimatedTodoList(upcomingTodos);

  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of animatedUpcoming) {
    const date = getEarliestDate(todo, today);
    const group = groupedByDate.get(date) || [];
    group.push(todo);
    groupedByDate.set(date, group);
  }

  const sortedDates = [...groupedByDate.keys()].sort();

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
    if (dateStr === tomorrowStr) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  function handlePreset(days: number) {
    setSelectedDays(days);
    setCustomRange(undefined);
  }

  function handleCustomRange(range: DateRange | undefined) {
    setCustomRange(range);
    if (range?.from) {
      setSelectedDays(-1); // deselect presets
    }
  }

  function clearCustomRange() {
    setCustomRange(undefined);
    setSelectedDays(7);
    setCustomOpen(false);
  }

  const isPresetActive = (days: number) =>
    !hasCustomRange && selectedDays === days;

  const filterLabel = hasCustomRange
    ? customFrom && customTo && customFrom !== customTo
      ? `${format(parseDateLocal(customFrom), "MMM d")} – ${format(parseDateLocal(customTo), "MMM d")}`
      : customFrom
        ? format(parseDateLocal(customFrom), "MMM d")
        : null
    : null;

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <YStack mb="$4">
        <Text fontSize="$7" fontWeight="700" color="$color">
          Upcoming
        </Text>
        <Text mt="$1" fontSize="$3" color="$mutedForeground">
          {upcomingTodos.length} upcoming todo
          {upcomingTodos.length !== 1 ? "s" : ""}
        </Text>
      </YStack>

      {/* Filter chips */}
      <XStack mb="$4" flexWrap="wrap" items="center" gap="$1.5">
        {PRESETS.map((preset) => {
          const active = isPresetActive(preset.days);
          return (
            <XStack
              key={preset.days}
              onPress={() => handlePreset(preset.days)}
              cursor="pointer"
              rounded={9999}
              borderWidth={1}
              px="$3"
              py="$1"
              transition="quick"
              borderColor={active ? "$primary" : "$borderColor"}
              bg={active ? "$primary" : "transparent"}
              hoverStyle={active ? undefined : { bg: "$accent" }}
            >
              <Text
                fontSize="$1"
                fontWeight="500"
                color={active ? "$primaryForeground" : "$mutedForeground"}
              >
                {preset.label}
              </Text>
            </XStack>
          );
        })}

        {/* Custom date picker */}
        <Popover
          open={customOpen}
          onOpenChange={setCustomOpen}
          placement="bottom-start"
        >
          <Popover.Trigger asChild>
            <XStack
              cursor="pointer"
              items="center"
              gap="$1"
              rounded={9999}
              borderWidth={1}
              px="$3"
              py="$1"
              transition="quick"
              borderColor={hasCustomRange ? "$primary" : "$borderColor"}
              bg={hasCustomRange ? "$primary" : "transparent"}
              color={hasCustomRange ? "$primaryForeground" : "$mutedForeground"}
              hoverStyle={hasCustomRange ? undefined : { bg: "$accent" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
              </svg>
              <Text
                fontSize="$1"
                fontWeight="500"
                color={
                  hasCustomRange ? "$primaryForeground" : "$mutedForeground"
                }
              >
                {filterLabel || "Custom"}
              </Text>
            </XStack>
          </Popover.Trigger>
          <Popover.Content width="auto">
            {hasCustomRange && (
              <XStack mb="$2" items="center" justify="space-between">
                <Text fontSize="$1" color="$mutedForeground">
                  {customRange?.to ? "Range selected" : "Pick end date"}
                </Text>
                <Button
                  intent="outline"
                  size="sm"
                  type="button"
                  onPress={clearCustomRange}
                >
                  Clear
                </Button>
              </XStack>
            )}
            <Calendar
              mode="range"
              // Kit's range shape is `{ start, end }`. We translate at the
              // boundary so the local `DateRange { from, to }` state can
              // stay unchanged (lots of downstream consumers of customRange).
              value={
                customRange
                  ? {
                      start: customRange.from ?? null,
                      end: customRange.to ?? null,
                    }
                  : null
              }
              onChange={(range) =>
                handleCustomRange({
                  from: range.start ?? undefined,
                  to: range.end ?? undefined,
                })
              }
              initialMonth={customRange?.from || addDays(new Date(), 1)}
              isDateDisabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                return d < now;
              }}
            />
          </Popover.Content>
        </Popover>
      </XStack>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <Text mt="$3" fontSize="$3" color="$mutedForeground">
          Loading todos...
        </Text>
      ) : (
        <YStack mt="$3" gap="$6">
          {sortedDates.map((date) => {
            const dateTodos = groupedByDate.get(date) || [];
            // Sub-group by list within each date
            const byList = new Map<string, Todo[]>();
            for (const todo of dateTodos) {
              const group = byList.get(todo.listId) || [];
              group.push(todo);
              byList.set(todo.listId, group);
            }

            return (
              <YStack key={date}>
                <Text mb="$3" fontSize="$3" fontWeight="600" color="$color">
                  {formatDateLabel(date)}
                </Text>
                <YStack gap="$4" pl="$1.5">
                  {[...byList.entries()].map(([listId, listTodos]) => {
                    const list = listMap.get(listId);
                    return (
                      <YStack key={listId}>
                        <XStack mb="$2" items="center" gap="$2">
                          <View
                            width={12}
                            height={12}
                            rounded={9999}
                            style={{
                              backgroundColor: list?.color || "#6b7280",
                            }}
                          />
                          <Text
                            fontSize="$1"
                            fontWeight="500"
                            color="$mutedForeground"
                          >
                            {list?.name || "Unknown List"}
                          </Text>
                        </XStack>
                        <YStack gap="$2">
                          {listTodos.map((todo) => (
                            <TodoItem
                              key={todo.id}
                              todo={todo}
                              listId={listId}
                              isCompleting={completingIds.has(todo.id)}
                            />
                          ))}
                        </YStack>
                      </YStack>
                    );
                  })}
                </YStack>
              </YStack>
            );
          })}

          {upcomingTodos.length === 0 && (
            <YStack py="$8" items="center">
              <Text fontSize="$3" color="$mutedForeground" text="center">
                No upcoming todos scheduled.
              </Text>
            </YStack>
          )}
        </YStack>
      )}
    </>
  );
}

function getEarliestDate(todo: Todo, today: string): string {
  const dueDateStr = todo.dueDate?.split("T")[0];
  const doDateStr = todo.doDate?.split("T")[0];
  const dates = [dueDateStr, doDateStr].filter(
    (d): d is string => d !== undefined && d > today,
  );
  dates.sort();
  return dates[0] || "";
}
