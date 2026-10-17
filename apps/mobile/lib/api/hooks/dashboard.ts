// apps/mobile/lib/api/hooks/dashboard.ts
//
// Today dashboard — ONE request, shaped by the shared selector.
//
// Replaces the old per-habit `useQueries` entries fan-out (hooks/today.ts's
// `useTodayHabitProgress`) with a single GET /dashboard/today?today= that the
// backend assembles (habits + currentStreak, today's entries, todos, today's
// ENCRYPTED journals, light). The heavy work stays OFF the render path:
//   - journals are decrypted in the `queryFn` (async, once per fetch), never
//     during render, so arriving data can't stall a tap;
//   - the view-model is computed in `select` via the pure `selectTodayViewModel`
//     (rings / habitStats / scheduled-today rows / today's todos / journal
//     words), so the Today screen just reads fields off `viewModel`.
// `keepPreviousData` paints the last view-model while a refetch is in flight,
// and the screen further commits `viewModel` through `useDeferredValue` so a
// fresh payload yields to interaction. See app/(authed)/index.tsx.

import { useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { selectTodayViewModel } from "@repo/core/dashboard/today-selector";
import { useLocalDayKey } from "@/lib/hooks/use-local-day";

import { apiClient } from "../client";
import { dashboardKeys } from "../keys";
import type { DashboardTodayPayload } from "../dashboard-cache";
import { decryptJournalList, getJournalDek } from "@/lib/journal-crypto";

// The payload shape lives in ../dashboard-cache, next to the functions that
// PATCH it — a second local copy here would silently drift from the writers.
// Note journals are ENCRYPTED on the wire and decrypted in the queryFn below
// (off the render path), so everything downstream of this hook sees plaintext.
type DashboardTodayResponse = DashboardTodayPayload;

/**
 * The Today dashboard aggregate. `viewModel` is the shaped `TodayViewModel`
 * (undefined until the first fetch resolves — the screen guards on it).
 */
export function useDashboardToday() {
  // Reactive, NOT a render-time `localDateKey()` snapshot: the Today screen is
  // a tab root that never unmounts, so a snapshot would pin this query to the
  // launch day forever and never refetch after midnight. See use-local-day.
  const today = useLocalDayKey();
  // Stable `select` identity so React Query CACHES the selected result and hands
  // back a referentially-stable `viewModel` across unrelated re-renders (palette
  // open, refreshing, editingTodo, chartsReady). An inline select re-runs every
  // render — a fresh view-model + fresh `rings` array each time — which would
  // defeat the screen's `useMemo`/`useDeferredValue` and re-animate the rings.
  const select = useCallback(
    (data: DashboardTodayResponse) =>
      selectTodayViewModel({
        habits: data.habits,
        todayEntries: data.todayEntries,
        todos: data.todos,
        journalsToday: data.journals,
        light: data.light,
        today: data.today,
        targets: {
          todoTargetDaily: data.light?.todoTargetDaily ?? 5,
          journalTargetDailyWords: data.light?.journalTargetDailyWords ?? 200,
        },
      }),
    [],
  );
  const q = useQuery({
    queryKey: dashboardKeys.today(today),
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardTodayResponse>(
        "/dashboard/today",
        { params: { today } },
      );
      // Decrypt here (async, once per fetch) so the render path never touches
      // ciphertext. When the journal is locked (no DEK), the entries stay as
      // the server sent them and the word count falls back to `wordCount`.
      const dek = getJournalDek();
      const journals = dek
        ? await decryptJournalList(data.journals, dek)
        : data.journals;
      return { ...data, journals };
    },
    placeholderData: keepPreviousData,
    select,
  });

  return {
    viewModel: q.data,
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
    raw: q,
  };
}
