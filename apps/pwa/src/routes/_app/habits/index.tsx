import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { LayoutGrid, List as ListIcon, Plus, Target } from "lucide-react";
import {
  Button,
  EmptyState,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useHabits } from "@/lib/api/habits";
import { useHabitGroups } from "@/lib/api/habit-groups";
import { useCalendarData } from "@/lib/api/calendar";
import {
  matchesHabitStatus,
  type HabitStatusFilter,
  type HabitDayEntry,
} from "@repo/core/habits/status-filter";
import { HabitDateNav } from "@/components/habits/habit-date-nav";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { MoveToGroupDialog } from "@/components/habits/move-to-group-dialog";
import {
  HabitGroupSection,
  type HabitViewMode,
} from "@/components/habits/habit-group-section";
import { CreateFab } from "@/components/shared/create-fab";
import { parseDateLocal } from "@/lib/date";
import type { Habit, HabitGroup } from "@repo/core/types";

/**
 * `useState` rather than localStorage for now — most users stick with
 * one mode per session. Promoting to a persisted preference is a one-line
 * change once habits + view-mode telemetry justifies it.
 */
const DEFAULT_VIEW_MODE: HabitViewMode = "card";

export const Route = createFileRoute("/_app/habits/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { status?: HabitStatusFilter } => {
    const s = search.status;
    return s === "todo" || s === "done" ? { status: s } : {};
  },
  component: HabitsPage,
});

/** One rendered section: a group (or the synthetic Ungrouped bucket). */
interface Section {
  id: string;
  /** Display name; the color dot uses `color`. */
  name: string;
  color?: string;
  /** Emoji icon — when present, shown instead of the color dot. */
  icon?: string;
  /** groupId for the reorder payload — null for Ungrouped. */
  groupId: string | null;
  habits: Habit[];
}

function HabitsPage() {
  const { data: habits, isLoading } = useHabits();
  const { data: groups } = useHabitGroups();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Habit | null>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<HabitViewMode>(DEFAULT_VIEW_MODE);

  const isViewingToday = selectedDate === todayStr;

  // Status filter (from the sidebar) — relative to the selected date. Entries
  // come from the calendar endpoint (one cached monthly query, shared with the
  // calendar page); only fetched when a status filter is active.
  const { status } = Route.useSearch();
  const selectedMonth = selectedDate.slice(0, 7);
  const { data: calendar, isLoading: statusLoading } = useCalendarData(
    status ? selectedMonth : "",
  );
  const entryByHabit = useMemo(() => {
    const m = new Map<string, HabitDayEntry>();
    for (const e of calendar?.[selectedDate]?.habitEntries ?? []) {
      m.set(e.habitId, {
        value: e.value,
        type: e.type,
        targetCountSnapshot: e.targetCountSnapshot,
      });
    }
    return m;
  }, [calendar, selectedDate]);

  // Section habits by group: ordered groups first, then "Ungrouped" LAST and
  // only when it has members. Within each section, sort by the habit `order`.
  // A status filter (if any) is applied to the full set first.
  const sections = useMemo<Section[]>(() => {
    const all = ((habits ?? []) as Habit[]).filter((h) =>
      matchesHabitStatus(h, status, entryByHabit.get(h.id), selectedDate),
    );
    const byOrder = (a: Habit, b: Habit) => (a.order ?? 0) - (b.order ?? 0);
    const orderedGroups = groups
      ? [...groups].sort(
          (a: HabitGroup, b: HabitGroup) => (a.order ?? 0) - (b.order ?? 0),
        )
      : [];

    const result: Section[] = orderedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      icon: g.icon,
      groupId: g.id,
      habits: all.filter((h) => h.groupId === g.id).sort(byOrder),
    }));

    const ungrouped = all.filter((h) => !h.groupId).sort(byOrder);
    if (ungrouped.length > 0) {
      result.push({
        id: "__ungrouped__",
        name: "Ungrouped",
        color: "#6b7280",
        groupId: null,
        habits: ungrouped,
      });
    }
    return result;
  }, [habits, groups, status, entryByHabit, selectedDate]);

  const hasHabits = (habits?.length ?? 0) > 0;
  const filteredCount = sections.reduce((n, s) => n + s.habits.length, 0);
  // While a status filter is active and its calendar data is still loading,
  // hold the skeleton so we don't flash a wrong "nothing here" state.
  const showSkeleton = isLoading || (!!status && statusLoading);

  return (
    <YStack gap="$6" p="$4">
      {/* Header — date filter (left), view-mode toggle + New Habit (right). */}
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <XStack items="center" gap="$3" flexWrap="wrap">
          <HabitDateNav
            value={parseDateLocal(selectedDate)}
            onChange={(d) => setSelectedDate(format(d, "yyyy-MM-dd"))}
          />
          {!isViewingToday && (
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setSelectedDate(todayStr)}
            >
              Back to today
            </Button>
          )}
        </XStack>
        <XStack items="center" gap="$2">
          {/* View-mode toggle. Replaces the kit SegmentedControl whose bright
              primary-blue selected fill clashed with the page's muted/orange
              palette. This is a minimal icon segmented control: a bordered
              track, the active cell carrying a soft `$muted` fill with the icon
              in the habit accent (orange), inactive icons muted-grey. Reads as
              on-brand and quiet, matching Linear/Notion-style view switchers. */}
          <XStack
            items="center"
            gap={2}
            p={2}
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
          >
            {(
              [
                { mode: "card", Icon: LayoutGrid, label: "Card view" },
                { mode: "list", Icon: ListIcon, label: "List view" },
              ] as const
            ).map(({ mode, Icon, label }) => {
              const active = viewMode === mode;
              return (
                <View
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  cursor="pointer"
                  items="center"
                  justify="center"
                  width={32}
                  height={26}
                  rounded="$2"
                  transition="quick"
                  bg={(active ? "$muted" : "transparent") as never}
                  hoverStyle={active ? {} : ({ bg: "$muted" } as never)}
                  role="button"
                  aria-label={label}
                >
                  <Icon
                    size={15}
                    color={
                      active ? "var(--ring-habit)" : "var(--muted-foreground)"
                    }
                    style={{ display: "block" }}
                  />
                </View>
              );
            })}
          </XStack>
          {/* Desktop only — on mobile the create affordance is the FAB below. */}
          <Button
            display="none"
            $md={{ display: "flex" }}
            borderWidth={0}
            {...({ color: "#ffffff" } as object)}
            icon={<Plus size={16} color="#ffffff" />}
            style={{ backgroundColor: "var(--ring-habit)" }}
            hoverStyle={
              { backgroundColor: "var(--ring-habit)", opacity: 0.9 } as never
            }
            pressStyle={
              {
                backgroundColor: "var(--ring-habit)",
                opacity: 0.82,
                scale: 0.96,
              } as never
            }
            onPress={() => setShowCreateDialog(true)}
          >
            New Habit
          </Button>
        </XStack>
      </XStack>

      {showSkeleton ? (
        // Loading skeleton — a single vertical column of placeholder cards,
        // matching the group-sectioned vertical Sortable layout.
        <YStack gap="$3">
          {[1, 2, 3].map((i) => (
            <YStack
              key={i}
              width="100%"
              rounded="$6"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$card"
              p="$5"
            >
              <XStack items="center" gap="$3">
                <Skeleton height={40} width={40} rounded="$lg" />
                <YStack gap="$2">
                  <Skeleton height={16} width={96} rounded="$sm" />
                  <Skeleton height={13} width={128} rounded="$sm" />
                </YStack>
              </XStack>
              <YStack mt="$4" gap="$2">
                <Skeleton height={8} width="100%" rounded={9999} />
              </YStack>
            </YStack>
          ))}
        </YStack>
      ) : !hasHabits ? (
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>No habits yet</EmptyState.Title>
          <EmptyState.Description>
            Create one to start tracking your progress.
          </EmptyState.Description>
        </EmptyState>
      ) : filteredCount === 0 ? (
        // A status filter is active but nothing matches for this day.
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>
            {status === "done" ? "Nothing completed yet" : "All caught up"}
          </EmptyState.Title>
          <EmptyState.Description>
            {status === "done"
              ? "No habits are marked done for this day."
              : "No habits left to do for this day."}
          </EmptyState.Description>
        </EmptyState>
      ) : (
        <YStack gap="$6">
          {sections
            .filter((s) => s.habits.length > 0)
            .map((section) => (
              <YStack key={section.id} gap="$3">
                {/* Group header — emoji (when set) or color dot, then name. */}
                <XStack items="center" gap="$2.5" px="$1">
                  {section.icon ? (
                    <Text fontSize={16} lineHeight={16} shrink={0}>
                      {section.icon}
                    </Text>
                  ) : (
                    <View
                      width={10}
                      height={10}
                      rounded={9999}
                      shrink={0}
                      style={{ backgroundColor: section.color || "#6b7280" }}
                    />
                  )}
                  <Text fontSize="$5" fontWeight="600" color="$color">
                    {section.name}
                  </Text>
                  <Text fontSize="$2" color="$mutedForeground">
                    {section.habits.length}
                  </Text>
                </XStack>
                <HabitGroupSection
                  habits={section.habits}
                  groupId={section.groupId}
                  viewMode={viewMode}
                  selectedDate={isViewingToday ? undefined : selectedDate}
                  onMoveToGroup={setMoveTarget}
                />
              </YStack>
            ))}
        </YStack>
      )}

      {/* Mobile create affordance — opens the same dialog as the desktop button. */}
      <CreateFab
        label="New habit"
        tintVar="--ring-habit"
        onPress={() => setShowCreateDialog(true)}
      />

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <MoveToGroupDialog
        habit={moveTarget}
        open={!!moveTarget}
        onOpenChange={(o) => {
          if (!o) setMoveTarget(null);
        }}
      />
    </YStack>
  );
}
