# SDD Progress Ledger — Non-Blocking Data Layer

Plan: docs/superpowers/plans/2026-07-29-non-blocking-data-layer.md
Branch: dev/mobile
Constraints: assistant does NO git/build/tests; user commits per phase; manual verification per task.

## Status

- [x] Phase 1 — core streak lift (1.1,1.2 done; 1.3 dropped, N/A)
- [x] Phase 2 — backend endpoints (Approved; 1 minor fixed, 1 tz nuance flagged)
- [x] Phase 3 — shared selector (Approved)
- [x] Phase 4 — mobile (4a,4b,4c+fix,4d all Approved)
- [x] Phase 5 — PWA (5a habits+fix, 5c journal epoch; dashboard-rewire skipped/documented)
- [x] Phase 6 — cleanup (dead today.ts removed, JSDoc fixed)

## Log

(append one line per completed unit)

Phase 1: COMPLETE — 1.1 core streak.ts created (pkg wildcard "./habits/\*" already covers it), 1.2 mobile re-export (6 names, all 7 importers use them). Controller-verified diff (mechanical transcription + exact-inverse re-export). 1.3 DROPPED: no PWA computeStreak mirror exists (shared entry-resolution already in core); the features HabitCard `calculateStreak` is target-aware (different algo) and already shared — rewiring would change behavior. Backend dashboard streak will use lifted computeStreak = current mobile dashboard parity.

Phase 2: COMPLETE (reviewer=opus, Approved). Created dashboard module (dto/service/controller/module) + common/date.ts (shiftDays); modified habit-entry service/module, habit service/controller/module, app.module. Circular Habit<->HabitEntry forwardRef mirrors existing HabitGroup pattern (verified). Entities returned via .toObject() (no getter-drop, no double toObject) — verified. Additive-only verified.
Minor findings: (1) FIXED by controller — clamped withEntries days to [1,366] (was unbounded parseInt). (2) OPEN/flagged to user: server-computed streak uses server-local "today" (computeStreak new Date()), not the client `today` param — far-offset client near midnight could be off by a day. Decision point at phase checkpoint; candidate fix = optional today arg on core computeStreak.

Phase 3: COMPLETE (controller-reviewed w/ mobile-parity context, Approved). Created packages/core/src/dashboard/today-selector.ts (selectTodayViewModel) + package.json "./dashboard/\*" export. Faithful parity: 2-predicate split (scheduledHabitsForDate for rendered rows vs isScheduledToday for habitStats/ring-max), todo done/total ring math == index.tsx todoStats, currentStreak type-erasure fixed via id-set re-filter. Payload is plain JSON (spread safe). isScheduledToday/isCheckedToday use wall clock (matches existing) — callers must compute today=localDateKey() immediately before input.

Phase 4a: COMPLETE (reviewer=opus, Approved). Created hooks/dashboard.ts (useDashboardToday: 1 req, decrypt-in-queryFn, select→selectTodayViewModel, keepPreviousData) + keys.dashboardKeys; rewrote index.tsx data layer (useDeferredValue, KPI/rings/todos parity 1:1, habit widget rows STILL self-fetch for now). Reviewer risks all clear (no dangling refs, KPI parity exact). Minor fix APPLIED: wrapped select in useCallback for stable viewModel identity (was defeating memo/deferred). useTodayHabitProgress now unused (delete in Phase 6).
4b plan refinement: row `entries` prop is OPTIONAL, self-fetch gated by `enabled: entries===undefined` — non-breaking (calendar day-agenda keeps self-fetching); Today+Habits pass entries to kill fan-out. Mutations must also patch dashboard + habits-withEntries caches for instant flip.

Phase 4b: COMPLETE (reviewer=opus, Approved; all 7 named risks clean). habits.ts: useHabitEntries/useSharedHabitEntries gained options.enabled; extracted upsertEntryArray; added patchDashboardEntry+patchWithEntries wired into upsertDayEntry/writeServerEntry/useUpdateHabitEntry.onMutate (additive). habit-check-in-row + habit-card-row: optional `entries` prop, self-fetch gated by enabled:entries===undefined. index.tsx Today widget passes entries. All non-index call sites (calendar/habits-section/detail) still self-fetch — non-breaking. WATCH (device QA): optimistic Today flip rides useDeferredValue — could trail tap by a frame under load (burst anim still instant).
4c DECISION: defer habits-list FlashList (known Sortable conflict, prior pass); do fan-out removal only (dominant win). Journal FlashList in 4d.

Phase 4c: COMPLETE (reviewer=sonnet ×2; first pass found 2 Important, FIX applied + re-Approved). useHabitsWithEntries fetches once + SEEDS per-habit caches ([...habitKeys.entries(id), habitEntriesWindow()]) so rows self-fetch from fresh cache (no network) AND check-in patches only habitKeys.entries(id) → only tapped row re-renders (cascade killed). patchWithEntries REMOVED (was causing full-list rebuild on every tap = documented regression). Empty-states now read deferredVisibleSections (no banner+list flash). Today path (patchDashboardEntry) untouched. staleTime 60s means seed isn't refetched on row mount (verified). MINOR (→Phase 6): stale JSDoc on useHabitsWithEntries still describes abandoned prop-threading.
4d DECISION: defer journal FlashList (list is paginated 20/page; JournalList is shared+date-grouped). Real fix = decrypt-in-queryFn.

Phase 4d: COMPLETE (reviewer=opus, Approved; all 6 named security risks pass). journal-crypto.ts: dekEpoch bumped in unlock/setup/change/recover/lock + checkJournalStatus cross-account re-lock. journal.ts: all 3 read hooks decrypt in queryFn + epoch in key; useUpdateJournal.onSuccess now DECRYPTS the PATCH echo before writing (beyond-brief catch) + targets epoch detail key; placeholder uses prefix-match getQueriesData. journal.tsx: removed decrypt state/effect. [id].tsx: locked = !!raw?.encrypted && !isUnlocked (decryptJournalEntry doesn't flip encrypted). No ciphertext rendered. FlashList deferred (paginated).

Phase 4 (MOBILE) COMPLETE: 4a Today + 4b rows/optimistic + 4c habits(+fix) + 4d journal. This is what removes the on-device freeze.

Streak-TZ fix (user-approved): computeStreak gained optional 3rd arg todayKey (anchors on client day); backward-compatible (client callers omit → wall clock). dashboard.service passes `today`. Files: packages/core/src/habits/streak.ts, apps/api/.../dashboard.service.ts.

Phase 5 (PWA) STARTED — mirror proven mobile design: 5a habits seed, 5b dashboard→/dashboard/today, 5c journal DEK-epoch. Reference impl = apps/mobile/lib/api/hooks/{dashboard,habits}.ts + journal.ts.

Phase 5a: COMPLETE (reviewer=sonnet found 1 CRITICAL, FIXED + controller-verified). PWA useHabitsWithEntries (key ["habits","withEntries",n]) fetches once + seeds ["habitEntries",id,{startDate,endDate}] matching HabitListItem window. /habits index + group.$groupId routes swapped. useReorderHabits rewritten to prefix helpers (impl caught bug). CRITICAL FIX: removed ["habits"] from HABIT_ENTRY_AGGREGATES — its prefix-match on ["habits","withEntries"] made EVERY check-in refetch the whole aggregate + re-seed all rows (cascade). Now entry mutations settle calendar+light only (mobile parity); verified all 4 entry mutations route through HABIT_ENTRY_AGGREGATES, list-shape mutations still invalidate ["habits"]. Sidebar useHabits() left (counts only, no fan-out).
DECISION: skip full PWA dashboard→/dashboard/today rewire — PWA dashboard numbers already come from /calendar aggregate (no fan-out), habit rows capped at 5. Documented as optional follow-up.

Phase 5c: COMPLETE (reviewer=sonnet, Approved). PWA encryption-store: dekEpoch (init 0) bumped in all 6 dek transitions (checkStatus-reset/setup/unlock/lock/change/recover). journals.ts: dekEpoch trailing segment on useJournals/useJournalsPaginated/useJournal; useUpdateJournal onMutate/onError/onSuccess exact-key detail writes redirected to ["journal",id,dekEpoch] (onSuccess re-reads current epoch — mid-flight safe); values plaintext (mutationFn decrypts); prefix ops unaffected. No decrypt logic changed.

Phase 5 (PWA) COMPLETE: 5a habits fan-out(+critical fix) + 5c journal epoch. Dashboard rewire intentionally skipped (documented).

--- Now Phase 6 cleanup + final whole-branch review ---

Phase 6: COMPLETE. Deleted dead apps/mobile/lib/api/hooks/today.ts (useTodayHabitProgress — zero consumers) + removed barrel export. Fixed stale JSDoc on mobile useHabitsWithEntries (described abandoned prop-threading). use-warm-tabs left as-is (now warms single-request screens).

FINAL WHOLE-BRANCH REVIEW (reviewer=opus): all structural/type boundary contracts PASS (dashboard response⟷hook interface⟷selector; habits withEntries⟷seed keys both platforms; plain /habits additive; computeStreak 3rd-arg backward-compat; surgical-write parity mobile+PWA). Found 1 Important behavioral regression: /dashboard/today todo query was [today,today] but selector expects full set → overdue todos dropped + todo ring under-counts. FIXED: dashboard.service now uses todoRepository.findByUser (all non-deleted, unpaginated) → selector filters restore old behavior. Verified findByUser query {userSub,deleted_at:null} returns entities.
Minor (DEFERRED, documented): (1) mobile useHabitsWithEntries seeds hardcoded 90d key while fetching windowDays (latent; all callers 90). (2) habits withEntries window UTC vs dashboard client-local (90d span absorbs it).

=== ALL PHASES COMPLETE (1-6 + final review + fix). Pending: USER build + on-device/browser QA + commit. Nothing committed by assistant. ===

POST-COMPLETION FIXES ("fix all of that"):

- Ran tsc across all 4 workspaces. ONE real error: dashboard.service computeStreak arg — entity .toObject() emits Date timestamps vs core HabitEntry string. FIXED with boundary cast `as unknown as CoreHabitEntry[]` (computeStreak only reads date/type/value). All 4 workspaces now tsc-CLEAN (core, api, mobile, pwa).
- Minor 1 FIXED: pinned useHabitsWithEntries to a FIXED 90d window (both platforms) — removed misleading windowDays param (rows always read the 90d habitEntriesWindow; a non-90 fetch would desync the seed).
- Minor 2 FIXED: GET /habits?withEntries now accepts optional client-local `today` (controller validates yyyy-mm-dd, service uses it, both hooks pass format(new Date())) — data window anchors on client day like /dashboard/today (was server UTC).
