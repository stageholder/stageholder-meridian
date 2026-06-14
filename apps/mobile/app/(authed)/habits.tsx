// apps/mobile/app/(authed)/habits.tsx
//
// Habits — the core loop. A list of cross-platform `HabitCard`s (from
// @repo/features, via HabitCardRow), each self-loading its own entry window so
// its streak math + week-dot strip render the same as the PWA. The check-in /
// skip / fail / undo / clear-status loop is wired to the habits mutation hooks
// and MUST work.
//
// PWA parity (condensed for one screen instead of the PWA's sidebar + routes):
//   - GROUP chips rail — All · each group (color dot + name; tap to filter; tap
//     the pencil on the active group to rename/recolor/delete) · "+ group" ·
//     "Archived" (the PWA's habits sidebar + group/archived routes, as a chips
//     row — mirrors the todos screen's list rail).
//   - GROUP-sectioned list — ordered groups first, Ungrouped LAST, each a kit
//     Sortable of cards (long-press to drag-reorder within the group; coexists
//     with PullToRefresh because Sortable.native activates on long-press).
//   - When a real group is active, only that section shows (header hidden).
//   - When "Archived" is active, the archived habits list with a Restore action
//     per card (no drag).
//
// Creation/editing uses the SAME cross-platform shared HabitForm as the PWA —
// see components/{create,edit}-habit-dialog.tsx, which now pass the user's
// groups so the form's group picker appears. The FAB opens create.

import {
  Banner,
  Button,
  EmptyState,
  PullToRefresh,
  Spinner,
  Text,
  View,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Habit, HabitGroup } from "@repo/core/types";
import {
  matchesHabitStatus,
  type HabitStatusFilter,
  type HabitDayEntry,
} from "@repo/core/habits/status-filter";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CreateFab } from "@/components/create-fab";
import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { EditHabitDialog } from "@/components/edit-habit-dialog";
import { HabitCardRow } from "@/components/habit-card-row";
import {
  ARCHIVED_CHIP,
  HabitGroupChips,
  type HabitChipSelection,
} from "@/components/habit-group-chips";
import { HabitGroupReorderSheet } from "@/components/habit-group-reorder-sheet";
import { HabitGroupSection } from "@/components/habit-group-section";
import { HabitGroupSheet } from "@/components/habit-group-sheet";
import { HabitMoveToGroupSheet } from "@/components/habit-move-to-group-sheet";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { StatusFilterTabs } from "@/components/status-filter-tabs";
import {
  useArchiveHabit,
  useArchivedHabits,
  useHabitGroups,
  useHabits,
  useUnarchiveHabit,
} from "@/lib/api";
import { useCalendarData } from "@/lib/api/hooks/calendar";
import { IGNITION } from "@/lib/ignition-palette";
import { localDateKey } from "@/lib/streak";

/** One rendered section: a group, or the synthetic Ungrouped bucket. */
interface Section {
  id: string;
  name: string;
  color: string;
  /** Emoji icon — when present, shown instead of the color dot. */
  icon?: string;
  /** groupId for the reorder payload — null for Ungrouped. */
  groupId: string | null;
  habits: Habit[];
}

export default function HabitsScreen() {
  const habitsQuery = useHabits();
  const groupsQuery = useHabitGroups();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const archiveHabit = useArchiveHabit();
  const unarchiveHabit = useUnarchiveHabit();

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The habit currently open in the edit sheet (null = closed). Lifted so the
  // sheet renders outside the scrolling list and re-mounts cleanly per habit.
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  // Active chip filter — null = All, ARCHIVED_CHIP = Archived, else a groupId.
  const [activeChip, setActiveChip] = useState<HabitChipSelection>(null);
  // Group sheet — false = closed, null = create, a group = edit.
  const [groupSheet, setGroupSheet] = useState<false | null | HabitGroup>(
    false,
  );
  // The habit whose move-to-group picker is open (null = closed).
  const [movingHabit, setMovingHabit] = useState<Habit | null>(null);
  // Status filter — "all" renders everything; "todo"/"done" filter by today's entry.
  const [statusFilter, setStatusFilter] = useState<"all" | HabitStatusFilter>(
    "all",
  );
  // Reorder-groups sheet.
  const [reorderGroupsOpen, setReorderGroupsOpen] = useState(false);

  const isArchivedView = activeChip === ARCHIVED_CHIP;
  // Archived view fetches its own cache lazily (only when that chip is active).
  const archivedQuery = useArchivedHabits();

  // Status filter data — today's date + the calendar month (only fetched when
  // a status filter is active; disabled by passing an empty string).
  const today = localDateKey();
  const calendarMonth = today.slice(0, 7);
  const { data: calendarData, isLoading: statusLoading } = useCalendarData(
    statusFilter !== "all" ? calendarMonth : "",
  );
  // Map habitId → today's entry for the status-filter predicate.
  const entryByHabit = useMemo<Map<string, HabitDayEntry>>(() => {
    const m = new Map<string, HabitDayEntry>();
    for (const e of calendarData?.[today]?.habitEntries ?? []) {
      m.set(e.habitId, {
        value: e.value,
        type: e.type,
        targetCountSnapshot: e.targetCountSnapshot,
      });
    }
    return m;
  }, [calendarData, today]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        habitsQuery.refetch(),
        groupsQuery.refetch(),
        isArchivedView ? archivedQuery.refetch() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const habits = habitsQuery.data ?? [];
  const groups = useMemo(
    () =>
      [...(groupsQuery.data ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [groupsQuery.data],
  );

  // Section habits by group: ordered groups first, Ungrouped LAST (and only
  // when it has members). Within each section, sort by the habit `order`.
  // A status filter (if active) is applied to the full set before sectioning.
  const sections = useMemo<Section[]>(() => {
    const activeStatus = statusFilter !== "all" ? statusFilter : undefined;
    const filtered = habits.filter((h) =>
      matchesHabitStatus(h, activeStatus, entryByHabit.get(h.id), today),
    );
    const byOrder = (a: Habit, b: Habit) => (a.order ?? 0) - (b.order ?? 0);

    const result: Section[] = groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color || "#6b7280",
      icon: g.icon,
      groupId: g.id,
      habits: filtered.filter((h) => h.groupId === g.id).sort(byOrder),
    }));

    const ungrouped = filtered.filter((h) => !h.groupId).sort(byOrder);
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
  }, [habits, groups, statusFilter, entryByHabit, today]);

  // When a real group is the active filter, render only that section.
  const visibleSections = useMemo(() => {
    const nonEmpty = sections.filter((s) => s.habits.length > 0);
    if (activeChip && activeChip !== ARCHIVED_CHIP) {
      return nonEmpty.filter((s) => s.groupId === activeChip);
    }
    return nonEmpty;
  }, [sections, activeChip]);

  function openDetail(habit: Habit) {
    router.push(`/habits/${habit.id}`);
  }

  function archive(habit: Habit) {
    archiveHabit.mutate(habit.id, {
      onSuccess: () =>
        toast.show({ title: `"${habit.name}" archived`, intent: "success" }),
      onError: () =>
        toast.show({ title: "Couldn't archive habit", intent: "danger" }),
    });
  }

  function restore(habit: Habit) {
    unarchiveHabit.mutate(habit.id, {
      onSuccess: () =>
        toast.show({ title: `"${habit.name}" restored`, intent: "success" }),
      onError: () =>
        toast.show({ title: "Couldn't restore habit", intent: "danger" }),
    });
  }

  const archivedHabits = archivedQuery.data ?? [];
  const hasHabits = habits.length > 0;
  // Hold loading while the status filter calendar data is still in-flight so
  // we don't flash a wrong empty state.
  const statusFilterLoading = statusFilter !== "all" && statusLoading;
  const showEmpty =
    !habitsQuery.isLoading &&
    !habitsQuery.error &&
    !statusFilterLoading &&
    !hasHabits;
  // Status-filter specific empty: habits exist but none match the filter today.
  const filteredEmpty =
    !habitsQuery.isLoading &&
    !habitsQuery.error &&
    !statusFilterLoading &&
    hasHabits &&
    statusFilter !== "all" &&
    visibleSections.length === 0;
  const archivedEmpty =
    isArchivedView &&
    !archivedQuery.isLoading &&
    !archivedQuery.error &&
    archivedHabits.length === 0;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack px="$4" pt="$4" gap="$3">
          <Text fontSize="$8" fontWeight="700" color="$color">
            Habits
          </Text>
          {/* Status filter — All / To do / Done, relative to today. */}
          <StatusFilterTabs
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "all" | HabitStatusFilter)
            }
          />
        </YStack>

        {/* Group chips rail — All · groups · pencil-on-active · "+ group" ·
            reorder · Archived. PWA sidebar/group/archived surfaces as chips. */}
        <HabitGroupChips
          groups={groups}
          active={activeChip}
          onSelect={setActiveChip}
          onEditActive={(g) => setGroupSheet(g)}
          onCreate={() => setGroupSheet(null)}
          onReorder={() => setReorderGroupsOpen(true)}
        />

        {/* PullToRefresh.native is the scroller — its child is the padded
            content column, not a nested ScrollView. Sortable.native drag
            activates on long-press, so it coexists with the scroll gesture. */}
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          <YStack
            gap="$4"
            px="$4"
            pt="$3"
            pb={BOTTOM_NAV_CLEARANCE + insets.bottom}
          >
            {/* Error — only when the active list itself failed. */}
            {(isArchivedView ? archivedQuery.error : habitsQuery.error) ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load habits</Banner.Title>
                  <Banner.Description>
                    {(
                      (isArchivedView
                        ? archivedQuery.error
                        : habitsQuery.error) as Error
                    ).message ?? "Network error."}
                  </Banner.Description>
                  <Banner.Action self="flex-end" mt="$2">
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={handleRefresh}
                    >
                      Try again
                    </Button>
                  </Banner.Action>
                </Banner.Body>
              </Banner>
            ) : null}

            {/* Loading — first fetch, before any data. */}
            {(
              isArchivedView
                ? archivedQuery.isLoading && archivedHabits.length === 0
                : habitsQuery.isLoading && habits.length === 0
            ) ? (
              <View py="$10" items="center" justify="center">
                <Spinner size="large" />
              </View>
            ) : null}

            {/* Status filter loading — hold the spinner while calendar data
                is in-flight so we don't flash a wrong empty state. */}
            {!isArchivedView && statusFilterLoading ? (
              <View py="$10" items="center" justify="center">
                <Spinner size="large" />
              </View>
            ) : null}

            {/* ── Archived view — restore per card, no drag. ── */}
            {isArchivedView ? (
              archivedEmpty ? (
                <EmptyState>
                  <EmptyState.IconSlot>
                    <Text fontSize={28}>🗄️</Text>
                  </EmptyState.IconSlot>
                  <EmptyState.Title>No archived habits</EmptyState.Title>
                  <EmptyState.Description>
                    Archive a habit from its menu to tuck it away here without
                    losing its history.
                  </EmptyState.Description>
                </EmptyState>
              ) : (
                <YStack gap="$2">
                  {archivedHabits.map((habit) => (
                    <HabitCardRow
                      key={habit.id}
                      habit={habit}
                      isArchived
                      onEdit={() => setEditingHabit(habit)}
                      onOpenDetail={() => openDetail(habit)}
                      onUnarchive={() => restore(habit)}
                    />
                  ))}
                </YStack>
              )
            ) : (
              <>
                {/* Empty — loaded, no active habits. */}
                {showEmpty ? (
                  <EmptyState>
                    <EmptyState.IconSlot>
                      <Text fontSize={28}>◎</Text>
                    </EmptyState.IconSlot>
                    <EmptyState.Title>No habits yet</EmptyState.Title>
                    <EmptyState.Description>
                      Add a daily ritual you want to keep — a walk, a few pages,
                      ten minutes of stillness.
                    </EmptyState.Description>
                  </EmptyState>
                ) : null}

                {/* Filtered empty — habits exist but none match the status
                    filter today. Message differs by filter direction. */}
                {filteredEmpty ? (
                  <EmptyState>
                    <EmptyState.IconSlot>
                      <Text fontSize={28}>
                        {statusFilter === "todo" ? "✓" : "◎"}
                      </Text>
                    </EmptyState.IconSlot>
                    <EmptyState.Title>
                      {statusFilter === "todo"
                        ? "All caught up"
                        : "Nothing completed yet"}
                    </EmptyState.Title>
                    <EmptyState.Description>
                      {statusFilter === "todo"
                        ? "All your habits for today are done. Nice work."
                        : "Check in on a habit to see it here."}
                    </EmptyState.Description>
                  </EmptyState>
                ) : null}

                {/* Group-sectioned list. When a single group is the active
                    filter, its header is hidden (the chip already names it). */}
                {visibleSections.map((section) => (
                  <HabitGroupSection
                    key={section.id}
                    name={section.name}
                    color={section.color}
                    icon={section.icon}
                    habits={section.habits}
                    groupId={section.groupId}
                    hideHeader={
                      !!activeChip &&
                      activeChip !== ARCHIVED_CHIP &&
                      visibleSections.length === 1
                    }
                    onEdit={setEditingHabit}
                    onOpenDetail={openDetail}
                    onArchive={archive}
                    onMoveToGroup={setMovingHabit}
                  />
                ))}
              </>
            )}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      {/* Create — opens the shared HabitForm (now with the group picker) in a
          bottom Sheet. habit-orange tint, lifted above the capsule. */}
      <CreateFab
        label="New habit"
        tint={IGNITION.habit.base}
        onPress={() => setCreateOpen(true)}
      />

      <CreateHabitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        // When a real group is the active filter, new habits land in it.
        groupId={
          activeChip && activeChip !== ARCHIVED_CHIP ? activeChip : undefined
        }
      />

      {/* Edit — same shared HabitForm, seeded from the tapped habit. */}
      {editingHabit ? (
        <EditHabitDialog
          habit={editingHabit}
          open={!!editingHabit}
          onOpenChange={(next) => {
            if (!next) setEditingHabit(null);
          }}
        />
      ) : null}

      {/* Create / edit a group — shared HabitGroupForm in a FormSheet. */}
      <HabitGroupSheet
        open={groupSheet !== false}
        onOpenChange={(next) => {
          if (!next) setGroupSheet(false);
        }}
        group={groupSheet === false ? null : groupSheet}
        onDeleted={(id) => {
          if (activeChip === id) setActiveChip(null);
        }}
      />

      {/* Move a habit to another group — driven picker Sheet. */}
      <HabitMoveToGroupSheet
        habit={movingHabit}
        open={movingHabit !== null}
        onOpenChange={(next) => {
          if (!next) setMovingHabit(null);
        }}
      />

      {/* Reorder groups — driven Sortable Sheet. */}
      <HabitGroupReorderSheet
        open={reorderGroupsOpen}
        onOpenChange={setReorderGroupsOpen}
        groups={groups}
      />
    </YStack>
  );
}
