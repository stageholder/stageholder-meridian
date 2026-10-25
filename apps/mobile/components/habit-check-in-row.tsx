// apps/mobile/components/habit-check-in-row.tsx
//
// Mobile wrapper over the shared @repo/features `HabitCheckInRow` — the compact,
// date-scoped, interactive habit row used by the calendar day-agenda, the Today
// dashboard, and the habits screen's list view. This file only does the mobile
// DATA wiring: it self-fetches the active day's entry (a tight one-day window)
// and routes the check-in / skip / fail / undo / clear handlers through the
// shared `useHabitDayActions` hook, then hands the resolved status + IGNITION
// accent (native needs raw hex) to the shared presentational row.
//
// The public API (habit, activeDate, onOpenDetail) is unchanged, so the calendar
// / Today / habits-list callers keep working without edits.

import { memo, useCallback } from "react";
import {
  HabitCheckInRow as SharedHabitCheckInRow,
  RadianceBurst,
  habitTint,
} from "@repo/features/habits";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import type { Habit, HabitEntry } from "@repo/core/types";

import { showActionSheet } from "@/lib/action-sheet";
import { useSharedHabitEntries } from "@/lib/api";
import { useHabitDayActions } from "@/lib/hooks/use-habit-day-actions";
import { IGNITION } from "@/lib/ignition-palette";

export interface HabitCheckInRowProps {
  habit: Habit;
  /** The day this row acts on (yyyy-mm-dd). */
  activeDate: string;
  /** When provided, the row uses these entries and does NOT self-fetch — the
   *  host already has them from an aggregate cache (Today's /dashboard/today,
   *  the Habits screen's /habits?withEntries). Omit to keep the self-fetch
   *  (calendar day-agenda). */
  entries?: HabitEntry[];
  /** Tap the icon/name → open the habit detail screen (host owns nav).
   *  Receives the habit, so hosts can pass ONE stable handler for every row
   *  (the memo below then bails rows whose habit/entries didn't change). */
  onOpenDetail?: (habit: Habit) => void;
}

// PERF: memoized — list hosts re-render on every filter/sheet/date change;
// a row only needs to re-render when its habit, entries or day change.
export const HabitCheckInRow = memo(function HabitCheckInRow({
  habit,
  activeDate,
  entries,
  onOpenDetail,
}: HabitCheckInRowProps) {
  const openDetail = useCallback(
    () => onOpenDetail?.(habit),
    [onOpenDetail, habit],
  );
  // THE canonical shared 90-day window — the old per-row 1-day window put the
  // same habit's entries under a separate cache key (extra fetch + observer
  // per row); the day-actions hook date-filters, so the wide array works.
  // Rules-of-hooks safe: the query still RUNS; `enabled` only gates the network
  // when the host already handed us `entries` (kills the per-row fan-out).
  const entriesQuery = useSharedHabitEntries(habit.id, activeDate, {
    enabled: entries === undefined,
  });
  const effectiveEntries = entries ?? entriesQuery.data;
  const actions = useHabitDayActions(habit.id, activeDate, effectiveEntries);
  const entry = actions.activeDateEntry;

  const value = entry?.value ?? 0;
  // Snapshotted target so "Done" agrees with the card view after a later
  // target change (skip/fail carry value 0 → never complete for target >= 1).
  const target = resolveTargetCount(entry ?? {}, habit) || 1;
  const isSkipped = entry?.type === "skip";
  const isFailed = entry?.type === "fail";

  return (
    <SharedHabitCheckInRow
      habit={habit}
      value={value}
      target={target}
      isSkipped={isSkipped}
      isFailed={isFailed}
      loading={
        entries === undefined &&
        entriesQuery.isLoading &&
        effectiveEntries === undefined
      }
      disabled={actions.isPending}
      // Resolved hex (IGNITION.habit) — the shared row applies these raw, since
      // tokens/CSS vars wouldn't resolve on native.
      accentColor={IGNITION.habit.base}
      accentTrackColor={habitTint(habit.color) ?? IGNITION.habit.track}
      onOpenDetail={onOpenDetail ? openDetail : undefined}
      onCheckIn={actions.checkIn}
      onSkip={actions.skip}
      onFail={actions.fail}
      onUndo={actions.undo}
      onClearStatus={actions.clearStatus}
      onShowMoreActions={() =>
        showActionSheet({
          title: habit.name,
          actions: [
            { label: "Skip", onPress: () => void actions.skip() },
            {
              label: "Mark as failed",
              destructive: true,
              onPress: () => void actions.fail(),
            },
          ],
        })
      }
      // Sunburst ANCHORED to the check-in control (parity with the PWA's
      // RadianceBurst) — NOT the full-screen kit Celebration, which emitted
      // particles in the middle of the screen. Rays + sparks fan out from
      // the button itself.
      renderCompletionEffect={(active) => (
        <RadianceBurst active={active} color={IGNITION.habit.base} />
      )}
      subtitle={
        target > 1 && !isSkipped && !isFailed
          ? `${value} / ${target}`
          : undefined
      }
    />
  );
});
