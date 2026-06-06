// apps/mobile/app/(authed)/habits.tsx
//
// Habits — the core loop. A list of cross-platform `HabitCard`s (from
// @repo/features), each self-loading its own entry window so its streak math +
// week-dot strip render the same as the PWA. The check-in / skip / fail / undo
// / clear-status loop is wired to the habits mutation hooks and MUST work.
//
// Each card lives in its own `HabitCardRow` component because HabitCard needs a
// `useHabitEntries` query + several mutation hooks, and React hooks can't run
// inside a `.map`. The row owns its own mutation wiring; the screen just lists.
//
// Creation uses the SAME cross-platform flow as the PWA: the kit Dialog adapts
// to a bottom Sheet on mobile and hosts the shared HabitForm (icon picker via
// the kit EmojiPickerSheet, day scheduler, quota config) — see
// components/create-habit-dialog.tsx. The FAB opens it. EDITING an existing
// habit reuses that same shared HabitForm seeded from the tapped habit — see
// components/edit-habit-dialog.tsx. Only the full detail SCREEN is still
// deferred (the per-card body tap nudges to the web app).

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
import { HabitCard } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CreateFab } from "@/components/create-fab";
import { CreateHabitDialog } from "@/components/create-habit-dialog";
import { EditHabitDialog } from "@/components/edit-habit-dialog";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import {
  useCheckInHabit,
  useDeleteHabit,
  useFailHabit,
  useHabitEntries,
  useHabits,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";
import { localDateKey } from "@/lib/streak";

export default function HabitsScreen() {
  const habitsQuery = useHabits();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The habit currently open in the edit sheet (null = closed). Lifted to the
  // screen so the sheet renders outside the scrolling list and re-mounts cleanly
  // per habit (the EditHabitDialog re-seeds the form via `key={open}`).
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await habitsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const habits = habitsQuery.data ?? [];
  const sorted = useMemo(
    () => [...habits].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [habits],
  );

  // The full habit DETAIL screen isn't built on mobile yet — tapping a card's
  // body nudges to the web app. (Edit + create ARE native — see the FAB below
  // and the per-card Edit action.)
  function notifyDetailOnWeb() {
    toast.show({
      title: "Open on the web app",
      message:
        "The full habit history and stats view lives on the web app for now.",
      intent: "info",
    });
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* PullToRefresh.native is the scroller — its child is the padded
            content column, not a nested ScrollView. */}
        <PullToRefresh
          refreshing={refreshing}
          onRefresh={handleRefresh}
          // Clearance for the floating BottomNav capsule — same contract as
          // the PWA shell's pb-[calc(5.5rem+env(safe-area-inset-bottom))].
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$4" px="$4" pt="$4" pb="$10">
            <Text fontSize="$8" fontWeight="700" color="$color">
              Habits
            </Text>

            {/* Error — only when the list itself failed. */}
            {habitsQuery.error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn&apos;t load habits</Banner.Title>
                <Banner.Description>
                  {(habitsQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
                <Banner.Action>
                  <Button intent="secondary" size="sm" onPress={handleRefresh}>
                    Try again
                  </Button>
                </Banner.Action>
              </Banner>
            ) : null}

            {/* Loading — first fetch, before any data. */}
            {habitsQuery.isLoading && habits.length === 0 ? (
              <View py="$10" items="center" justify="center">
                <Spinner size="large" />
              </View>
            ) : null}

            {/* Empty — loaded, no habits. */}
            {!habitsQuery.isLoading &&
            !habitsQuery.error &&
            habits.length === 0 ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={28}>◎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>No habits yet</EmptyState.Title>
                <EmptyState.Description>
                  Add a daily ritual you want to keep — a walk, a few pages, ten
                  minutes of stillness.
                </EmptyState.Description>
                <EmptyState.Actions>
                  <Button intent="primary" onPress={() => setCreateOpen(true)}>
                    Create your first habit
                  </Button>
                </EmptyState.Actions>
              </EmptyState>
            ) : null}

            {/* List — one self-loading row per habit. */}
            {sorted.map((habit) => (
              <HabitCardRow
                key={habit.id}
                habit={habit}
                onEdit={() => setEditingHabit(habit)}
                onOpenDetail={notifyDetailOnWeb}
              />
            ))}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      {/* Create — opens the shared HabitForm in a bottom Sheet (same flow as
          the PWA). CreateFab mirrors the PWA's: lifted above the capsule,
          habit-orange tint. */}
      <CreateFab
        label="New habit"
        tint={IGNITION.habit.base}
        onPress={() => setCreateOpen(true)}
      />

      <CreateHabitDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit — same shared HabitForm in a bottom Sheet, seeded from the tapped
          habit. Mounted only while a habit is selected so the form re-seeds per
          habit; closing clears the selection. */}
      {editingHabit ? (
        <EditHabitDialog
          habit={editingHabit}
          open={!!editingHabit}
          onOpenChange={(next) => {
            if (!next) setEditingHabit(null);
          }}
        />
      ) : null}
    </YStack>
  );
}

/* ----------------------------- Per-habit row ------------------------------- */

interface HabitCardRowProps {
  habit: Habit;
  /** Opens the native edit sheet for this habit (per-card Edit action). */
  onEdit: () => void;
  /** Called for the detail screen, which isn't built on mobile yet. */
  onOpenDetail: () => void;
}

/**
 * One habit's card + its data wiring. Split out so each row can run its own
 * `useHabitEntries` + mutation hooks (hooks can't run inside the list `.map`).
 *
 * Mutations resolve via `mutateAsync` so HabitCard can sequence its bounce /
 * completion animations on success (the view awaits `onCheckIn` etc. and skips
 * the celebration when the promise rejects). The hooks are optimistic, so the
 * card flips instantly; the awaited promise just gates the animation.
 */
function HabitCardRow({ habit, onEdit, onOpenDetail }: HabitCardRowProps) {
  const entriesQuery = useHabitEntries(habit.id);
  const checkIn = useCheckInHabit();
  const skip = useSkipHabit();
  const fail = useFailHabit();
  const updateEntry = useUpdateHabitEntry();
  const deleteHabit = useDeleteHabit();

  const today = localDateKey();
  const entries = entriesQuery.data;

  // The active-date entry — needed so Undo / Clear-status can target the right
  // entry id (PATCH, not DELETE, mirroring the PWA's habit-card undo path).
  const todayEntry = entries?.find((e) => e.date.split("T")[0] === today);

  const isPending =
    checkIn.isPending ||
    skip.isPending ||
    fail.isPending ||
    updateEntry.isPending;

  return (
    <HabitCard
      habit={habit}
      entries={entries}
      // Resolved hex (IGNITION.habit) — HabitCard applies these via the style
      // hatch (`backgroundColor`), so raw colors are required (tokens / CSS
      // vars wouldn't resolve on native).
      accentColor={IGNITION.habit.base}
      accentTrackColor={IGNITION.habit.track}
      isPending={isPending}
      onCheckIn={() => checkIn.mutateAsync({ habitId: habit.id })}
      onSkip={() => skip.mutateAsync({ habitId: habit.id })}
      onFail={() => fail.mutateAsync({ habitId: habit.id })}
      onUndo={() => {
        // Decrement today's value by 1 (PATCH). No-op when there's no entry —
        // HabitCard already guards `activeDateValue <= 0` before calling.
        if (!todayEntry) return Promise.resolve();
        return updateEntry.mutateAsync({
          habitId: habit.id,
          entryId: todayEntry.id,
          patch: { value: Math.max(0, (todayEntry.value ?? 0) - 1) },
        });
      }}
      onClearStatus={() => {
        // Clear a skip/fail back to an un-acted day: value-0 completion entry.
        if (!todayEntry) return Promise.resolve();
        return updateEntry.mutateAsync({
          habitId: habit.id,
          entryId: todayEntry.id,
          patch: { value: 0, type: "completion" },
        });
      }}
      // Edit opens the native edit sheet; the full detail screen is still
      // deferred and nudges toward the web app.
      onEdit={onEdit}
      onOpenDetail={onOpenDetail}
      // Delete IS wired — the card's own AlertDialog confirms first.
      onDelete={() => deleteHabit.mutate(habit.id)}
    />
  );
}
