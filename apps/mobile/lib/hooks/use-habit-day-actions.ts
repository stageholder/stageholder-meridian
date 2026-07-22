// apps/mobile/lib/hooks/use-habit-day-actions.ts
//
// The single source of truth for a habit's per-day check-in mutations on
// mobile. Both the big-card wrapper (`HabitCardRow`) and the compact agenda
// row (`HabitCheckInRow`) drive their check-in / skip / fail / undo / clear
// controls through this hook, so the create-or-update rules live in ONE place
// instead of being copy-pasted per surface (the parity-audit dedup).
//
// Every action follows the create-or-update rule: the API has ONE entry per
// habit per day, so POSTing a second one for a day that already has an entry
// returns 409. When there's no entry yet we POST (check-in / skip / fail);
// otherwise we PATCH the existing one. The date is a parameter (NOT hardcoded
// to today), so the same hook works on the calendar's selected day and the
// habits screen's date-nav — the underlying hooks already accept `date`.
//
// `checkIn` re-throws on failure so an awaiting caller (e.g. HabitCard's
// completion animation) can skip its celebration; the non-completion actions
// toast on failure and swallow (their optimistic write has already rolled back
// via the mutation's onError).

import { toast } from "@stageholder/ui";
import type { HabitEntry } from "@repo/core/types";

import {
  useCheckInHabit,
  useFailHabit,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";

export interface HabitDayActions {
  /** The entry for `activeDate` (create-or-update target), if any. */
  activeDateEntry: HabitEntry | undefined;
  /** True only while a just-created entry is still an unsaved optimistic record
   *  — acting on it would PATCH a synthetic id (404). Clears when the create
   *  resolves. NOT the network `isPending` (the cache already reflects taps, and
   *  entry writes are scope-serialized, so the control stays responsive). */
  isPending: boolean;
  checkIn: () => Promise<void>;
  skip: () => Promise<void>;
  fail: () => Promise<void>;
  undo: () => Promise<void>;
  clearStatus: () => Promise<void>;
}

export function useHabitDayActions(
  habitId: string,
  activeDate: string,
  entries: HabitEntry[] | undefined,
): HabitDayActions {
  const checkIn = useCheckInHabit();
  const skip = useSkipHabit();
  const fail = useFailHabit();
  const updateEntry = useUpdateHabitEntry();

  // Match on the date-only slice — API entry dates are ISO datetimes, so a bare
  // `e.date === activeDate` would never hit (the long-standing mobile bug).
  const activeDateEntry = entries?.find(
    (e) => e.date.slice(0, 10) === activeDate,
  );
  const isPending = activeDateEntry?.id?.startsWith("optimistic-") ?? false;

  return {
    activeDateEntry,
    isPending,
    checkIn: async () => {
      try {
        if (!activeDateEntry) {
          await checkIn.mutateAsync({ habitId, date: activeDate });
        } else {
          const isNonCompletion =
            activeDateEntry.type === "skip" || activeDateEntry.type === "fail";
          await updateEntry.mutateAsync({
            habitId,
            entryId: activeDateEntry.id,
            patch: isNonCompletion
              ? { type: "completion", value: 1 }
              : { value: (activeDateEntry.value ?? 0) + 1 },
          });
        }
      } catch (e) {
        toast.error("Couldn't check in");
        // Re-throw so an awaiting caller skips its celebration.
        throw e;
      }
    },
    skip: async () => {
      try {
        if (!activeDateEntry) {
          await skip.mutateAsync({ habitId, date: activeDate });
        } else {
          await updateEntry.mutateAsync({
            habitId,
            entryId: activeDateEntry.id,
            patch: { type: "skip", value: 0 },
          });
        }
      } catch {
        toast.error("Couldn't skip");
      }
    },
    fail: async () => {
      try {
        if (!activeDateEntry) {
          await fail.mutateAsync({ habitId, date: activeDate });
        } else {
          await updateEntry.mutateAsync({
            habitId,
            entryId: activeDateEntry.id,
            patch: { type: "fail", value: 0 },
          });
        }
      } catch {
        toast.error("Couldn't mark failed");
      }
    },
    undo: async () => {
      if (!activeDateEntry) return;
      try {
        await updateEntry.mutateAsync({
          habitId,
          entryId: activeDateEntry.id,
          patch: { value: Math.max(0, (activeDateEntry.value ?? 0) - 1) },
        });
      } catch {
        toast.error("Couldn't undo");
      }
    },
    clearStatus: async () => {
      if (!activeDateEntry) return;
      try {
        await updateEntry.mutateAsync({
          habitId,
          entryId: activeDateEntry.id,
          patch: { value: 0, type: "completion" },
        });
      } catch {
        toast.error("Couldn't clear status");
      }
    },
  };
}
