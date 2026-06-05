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
// Creation/editing is DEFERRED this pass — the habit form (icon picker, day
// scheduler, quota config) is a substantial surface that lives on the web app
// for now. The FAB surfaces that intent with a toast rather than a dead button,
// so the affordance is discoverable but honest about where to create.

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  PullToRefresh,
  Spinner,
  Text,
  View,
  YStack,
  useToast,
} from "@stageholder/ui";
// Icons come straight from @tamagui/lucide-icons-2 (the kit doesn't re-export
// them) — they read their OWN `color` prop, so tint goes directly on the icon.
import { Plus } from "@tamagui/lucide-icons-2";
import { HabitCard } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const [refreshing, setRefreshing] = useState(false);

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

  function notifyManageOnWeb() {
    toast.show({
      title: "Create habits on the web app",
      message:
        "Habit creation (schedule, icon, quota) lives on the web app for now.",
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
          contentContainerStyle={{ paddingBottom: 40 }}
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
                  minutes of stillness. Create your first habit on the web app,
                  then check in here.
                </EmptyState.Description>
                <EmptyState.Actions>
                  <Button intent="outline" onPress={notifyManageOnWeb}>
                    How to add a habit
                  </Button>
                </EmptyState.Actions>
              </EmptyState>
            ) : null}

            {/* List — one self-loading row per habit. */}
            {sorted.map((habit) => (
              <HabitCardRow
                key={habit.id}
                habit={habit}
                onManageOnWeb={notifyManageOnWeb}
              />
            ))}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      {/* Creation deferred — the FAB nudges toward the web app via a toast
          instead of opening a (not-yet-built) mobile habit form. Lifted above
          the tab bar so it isn't covered. */}
      <FAB
        icon={<Plus size={24} color="#ffffff" />}
        placement="bottom-right"
        onPress={notifyManageOnWeb}
        b={96}
      />
    </YStack>
  );
}

/* ----------------------------- Per-habit row ------------------------------- */

interface HabitCardRowProps {
  habit: Habit;
  /** Called for edit/detail actions we don't yet support on mobile. */
  onManageOnWeb: () => void;
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
function HabitCardRow({ habit, onManageOnWeb }: HabitCardRowProps) {
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
      // Edit + detail are deferred on mobile — both nudge toward the web app.
      onEdit={onManageOnWeb}
      onOpenDetail={onManageOnWeb}
      // Delete IS wired — the card's own AlertDialog confirms first.
      onDelete={() => deleteHabit.mutate(habit.id)}
    />
  );
}
