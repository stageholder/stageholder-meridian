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

import {
  HabitCheckInRow as SharedHabitCheckInRow,
  RadianceBurst,
} from "@repo/features/habits";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import type { Habit } from "@repo/core/types";

import { useSharedHabitEntries } from "@/lib/api";
import { useHabitDayActions } from "@/lib/hooks/use-habit-day-actions";
import { IGNITION } from "@/lib/ignition-palette";

export interface HabitCheckInRowProps {
  habit: Habit;
  /** The day this row acts on (yyyy-mm-dd). */
  activeDate: string;
  /** Tap the icon/name → open the habit detail screen (host owns nav). */
  onOpenDetail?: () => void;
}

export function HabitCheckInRow({
  habit,
  activeDate,
  onOpenDetail,
}: HabitCheckInRowProps) {
  // THE canonical shared 90-day window — the old per-row 1-day window put the
  // same habit's entries under a separate cache key (extra fetch + observer
  // per row); the day-actions hook date-filters, so the wide array works.
  const entriesQuery = useSharedHabitEntries(habit.id, activeDate);
  const entries = entriesQuery.data;
  const actions = useHabitDayActions(habit.id, activeDate, entries);
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
      loading={entriesQuery.isLoading && entries === undefined}
      disabled={actions.isPending}
      // Resolved hex (IGNITION.habit) — the shared row applies these raw, since
      // tokens/CSS vars wouldn't resolve on native.
      accentColor={IGNITION.habit.base}
      accentTrackColor={IGNITION.habit.track}
      onOpenDetail={onOpenDetail}
      onCheckIn={actions.checkIn}
      onSkip={actions.skip}
      onFail={actions.fail}
      onUndo={actions.undo}
      onClearStatus={actions.clearStatus}
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
}
