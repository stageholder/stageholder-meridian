import { useState, type ReactNode } from "react";
import { format, isToday as isTodayFn } from "date-fns";
import { Plus, ChevronRight, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import {
  ActivityRings,
  AnimatePresence,
  IconButton,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useTodoLists, useAllTodos } from "@/lib/api/todos";
import { TodoItem } from "@/components/todos/todo-item";
import { HabitListItem } from "@/components/habits/habit-list-item";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import {
  computeActivityRings,
  activityRingsConfig,
} from "@/lib/hooks/use-activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit, Todo } from "@repo/core/types";

// Quota (`weekly_target`) habits aren't day-scheduled, so they're excluded
// from the per-day habit-ring denominator + the day's actionable habit list.
function scheduledDayHabits(habits: Habit[], date: Date): Habit[] {
  const dow = date.getDay();
  return habits.filter(
    (h) =>
      h.frequency !== "weekly_target" &&
      (!h.scheduledDays?.length || h.scheduledDays.includes(dow)),
  );
}

function SectionHeader({
  color,
  label,
  count,
  action,
}: {
  color: string;
  label: string;
  count: number;
  /** Right-aligned affordance (the tinted "+" add button). */
  action?: ReactNode;
}) {
  return (
    <XStack items="center" justify="space-between" gap="$2">
      <XStack items="center" gap="$2">
        <View
          width={8}
          height={8}
          rounded={9999}
          style={{ backgroundColor: color }}
        />
        <Text
          fontSize="$1"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          {label} ({count})
        </Text>
      </XStack>
      {action}
    </XStack>
  );
}

/** Small category-tinted "+" that sits on the right of a section header. */
function AddButton({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <IconButton variant="ghost" size="sm" aria-label={label} onPress={onPress}>
      <Plus size={16} color={color} />
    </IconButton>
  );
}

/**
 * Collapsible "Completed / Done (n)" group, hidden by default — the /todos
 * page's CompletedSection pattern, generalised so todos AND habits can tuck
 * their finished items away and keep the day panel clean.
 */
function CollapsibleGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <YStack gap="$1">
      <XStack
        onPress={() => setOpen((v) => !v)}
        cursor="pointer"
        items="center"
        gap="$1.5"
        rounded="$md"
        py="$1"
        transition="quick"
        hoverStyle={{ bg: "$accent" }}
        role="button"
        aria-expanded={open}
      >
        <Text color="$mutedForeground" lineHeight={0}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Text>
        <Text
          fontSize="$1"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          {label}
        </Text>
        <Text fontSize="$1" color="$mutedForeground">
          {count}
        </Text>
      </XStack>
      {open ? <YStack gap="$2">{children}</YStack> : null}
    </YStack>
  );
}

interface DayAgendaProps {
  date: Date;
  dayData: CalendarDayData;
  habits: Habit[];
  /** Cold-loading — show a skeleton instead of a fake empty day. */
  isLoading?: boolean;
}

export function DayAgenda({
  date,
  dayData,
  habits,
  isLoading,
}: DayAgendaProps) {
  const navigate = useNavigate();
  const { data: lists } = useTodoLists();
  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [showCreateHabit, setShowCreateHabit] = useState(false);
  const { data: allTodos } = useAllTodos();

  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = isTodayFn(date);

  const scheduledHabits = scheduledDayHabits(habits, date);

  // The calendar day payload carries only a slim todo shape; the real
  // `TodoItem` needs the full `Todo`, so resolve each against `allTodos`. The
  // real item + its mutations invalidate `["calendar"]`, so completing a todo
  // (with its burn) refreshes this panel's rings automatically.
  const dayTodos = dayData.todos
    .map((t) => allTodos?.find((a) => a.id === t.id))
    .filter((t): t is Todo => !!t);

  // Split into pending (shown) vs finished (tucked in a collapsible group).
  const activeTodos = dayTodos.filter((t) => t.status !== "done");
  const completedTodos = dayTodos.filter((t) => t.status === "done");

  // A habit is "resolved" for the day when its calendar entry is complete,
  // skipped, or failed. Read from the day's entries so the panel doesn't need
  // to re-fetch per habit (HabitListItem owns that; the calendar data stays in
  // sync via the shared `["calendar"]` invalidation on check-in).
  const habitResolved = (habit: Habit): boolean => {
    const entry = dayData.habitEntries.find((e) => e.habitId === habit.id);
    if (!entry) return false;
    if (entry.type === "skip" || entry.type === "fail") return true;
    const target =
      resolveTargetCount(
        { targetCountSnapshot: entry.targetCountSnapshot },
        habit,
      ) || 1;
    return entry.value >= target;
  };
  const pendingHabits = scheduledHabits.filter((h) => !habitResolved(h));
  const doneHabits = scheduledHabits.filter((h) => habitResolved(h));

  // Cold load — a skeleton mirroring the layout, so the panel never shows a
  // FAKE empty day (zero rings, "Nothing due", "No habits") before the real
  // data lands. The date header stays (it's known, not fetched).
  if (isLoading) {
    return (
      <YStack gap="$4">
        <XStack items="center" gap="$3">
          <Skeleton width={48} height={48} rounded={9999} />
          <YStack flex={1} minW={0} gap="$1.5">
            <Text fontSize="$7" fontWeight="700" color="$color">
              {isToday ? "Today" : format(date, "EEEE")}
            </Text>
            <Text fontSize="$2" color="$mutedForeground">
              {format(date, "MMMM d, yyyy")}
            </Text>
          </YStack>
        </XStack>
        {[0, 1, 2].map((i) => (
          <YStack key={i} gap="$2">
            <Skeleton width={72} height={12} rounded="$2" />
            <Skeleton width="100%" height={60} rounded="$4" />
          </YStack>
        ))}
      </YStack>
    );
  }

  return (
    <>
      <YStack gap="$4">
        {/* Header — date + activity ring */}
        <XStack items="center" gap="$3">
          <ActivityRings
            rings={activityRingsConfig(
              computeActivityRings(
                dayData,
                scheduledHabits.length,
                undefined,
                new Set(
                  habits
                    .filter((h) => h.frequency === "weekly_target")
                    .map((h) => h.id),
                ),
              ),
            )}
            size={48}
            thickness={5}
            gap={3}
          />
          <YStack flex={1} minW={0}>
            <Text fontSize="$7" fontWeight="700" color="$color">
              {isToday ? "Today" : format(date, "EEEE")}
            </Text>
            <Text fontSize="$2" color="$mutedForeground">
              {format(date, "MMMM d, yyyy")}
            </Text>
          </YStack>
        </XStack>

        {/* Todos — the real `TodoItem` (checkbox + burn, actions menu, detail
            dialog), compact. The "+" on the section header creates a todo. */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-todo)"
            label="Todos"
            count={dayData.todos.length}
            action={
              <AddButton
                color="var(--ring-todo)"
                label="Add todo"
                onPress={() => setShowCreateTodo(true)}
              />
            }
          />
          {activeTodos.length === 0 && completedTodos.length === 0 ? (
            <Text fontSize="$1" color="$mutedForeground">
              Nothing due
            </Text>
          ) : (
            <>
              {activeTodos.length > 0 ? (
                <YStack gap="$2">
                  <AnimatePresence>
                    {activeTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        listId={todo.listId}
                        showList
                        compact
                      />
                    ))}
                  </AnimatePresence>
                </YStack>
              ) : null}
              {/* Finished todos tucked into a collapsible group (todo-page style). */}
              <CollapsibleGroup label="Completed" count={completedTodos.length}>
                <AnimatePresence>
                  {completedTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      listId={todo.listId}
                      showList
                      compact
                    />
                  ))}
                </AnimatePresence>
              </CollapsibleGroup>
            </>
          )}
        </YStack>

        {/* Habits — the real `HabitListItem` list-view row (icon · name ·
            week-dot streak strip · check-in / status · skip/fail/undo menu),
            scoped to THIS day via `selectedDate`. */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-habit)"
            label="Habits"
            count={scheduledHabits.length}
            action={
              <AddButton
                color="var(--ring-habit)"
                label="Add habit"
                onPress={() => setShowCreateHabit(true)}
              />
            }
          />
          {scheduledHabits.length === 0 ? (
            <Text fontSize="$1" color="$mutedForeground">
              No habits scheduled
            </Text>
          ) : (
            <>
              {pendingHabits.length > 0 ? (
                <YStack gap="$2">
                  {pendingHabits.map((habit) => (
                    <HabitListItem
                      key={habit.id}
                      habit={habit}
                      selectedDate={dateStr}
                    />
                  ))}
                </YStack>
              ) : null}
              {/* Completed / skipped / failed habits tucked away. */}
              <CollapsibleGroup label="Done" count={doneHabits.length}>
                {doneHabits.map((habit) => (
                  <HabitListItem
                    key={habit.id}
                    habit={habit}
                    selectedDate={dateStr}
                  />
                ))}
              </CollapsibleGroup>
            </>
          )}
        </YStack>

        {/* Journal */}
        <YStack gap="$2">
          <SectionHeader
            color="var(--ring-journal)"
            label="Journal"
            count={dayData.journals.length}
            action={
              <AddButton
                color="var(--ring-journal)"
                label="New journal"
                onPress={() =>
                  void navigate({
                    to: "/journal/new",
                    search: { date: dateStr },
                  })
                }
              />
            }
          />
          {dayData.journals.length > 0 ? (
            <YStack gap="$1">
              {dayData.journals.map((journal) => (
                <Link
                  key={journal.id}
                  to="/journal/$id"
                  params={{ id: journal.id }}
                  style={{ textDecoration: "none" }}
                >
                  <Text
                    rounded="$md"
                    px="$2"
                    py="$1.5"
                    fontSize="$3"
                    color="$color"
                    numberOfLines={1}
                    hoverStyle={{ bg: "$accent" }}
                  >
                    {journal.title || "Untitled entry"}
                  </Text>
                </Link>
              ))}
            </YStack>
          ) : (
            <Text fontSize="$1" color="$mutedForeground">
              No journal entries
            </Text>
          )}
        </YStack>
      </YStack>

      {defaultList && (
        <CreateTodoDialog
          open={showCreateTodo}
          onOpenChange={setShowCreateTodo}
          listId={defaultList.id}
          defaultDueDate={dateStr}
        />
      )}

      <CreateHabitDialog
        open={showCreateHabit}
        onOpenChange={setShowCreateHabit}
      />
    </>
  );
}
