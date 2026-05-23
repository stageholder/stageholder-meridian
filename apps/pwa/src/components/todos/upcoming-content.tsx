import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import {
  AnimatePresence,
  DateRangePicker,
  Text,
  View,
  XStack,
  YStack,
  type CalendarRangeValue,
} from "@stageholder/ui";
import { format, addDays } from "date-fns";
import { TodoListSkeleton } from "./todo-list-skeleton";
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
  const [customRange, setCustomRange] = useState<CalendarRangeValue | null>(
    null,
  );

  const isLoading = todosLoading || listsLoading;

  const today = format(new Date(), "yyyy-MM-dd");

  const hasCustomRange = customRange?.start != null;
  const customFrom = customRange?.start
    ? format(customRange.start, "yyyy-MM-dd")
    : null;
  const customTo = customRange?.end
    ? format(customRange.end, "yyyy-MM-dd")
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

  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of upcomingTodos) {
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
    setCustomRange(null);
  }

  function handleCustomRange(range: CalendarRangeValue) {
    setCustomRange(range);
    if (range.start) setSelectedDays(-1); // a custom range deselects presets
  }

  const isPresetActive = (days: number) =>
    !hasCustomRange && selectedDays === days;

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <XStack mb="$4" items="center" gap="$3">
        <Text color="$mutedForeground" lineHeight={0}>
          <CalendarClock size={24} />
        </Text>
        <YStack>
          <Text fontSize="$7" fontWeight="700" color="$color">
            Upcoming
          </Text>
          <Text mt="$1" fontSize="$3" color="$mutedForeground">
            {upcomingTodos.length} upcoming todo
            {upcomingTodos.length !== 1 ? "s" : ""}
          </Text>
        </YStack>
      </XStack>

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

        {/* Custom range — kit DateRangePicker (replaces the hand-rolled
            Calendar popover). Past dates are disabled since this view is for
            upcoming todos. */}
        <DateRangePicker
          value={customRange}
          onChange={handleCustomRange}
          placeholder="Custom range"
          isDateDisabled={(date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return d < now;
          }}
        />
      </XStack>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <TodoListSkeleton />
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
                        <YStack gap="$0.5">
                          <AnimatePresence>
                            {listTodos.map((todo) => (
                              <TodoItem
                                key={todo.id}
                                todo={todo}
                                listId={listId}
                              />
                            ))}
                          </AnimatePresence>
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
