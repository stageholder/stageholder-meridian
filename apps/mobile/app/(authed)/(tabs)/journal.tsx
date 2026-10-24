// apps/mobile/app/(authed)/journal.tsx
//
// Journal — encryption-aware list. Three states:
//
//   1. LOCKED   (encryption set up, DEK not in memory) → PassphrasePrompt.
//      Unlocking derives the master key from the passphrase + server salt and
//      unwraps the DEK into memory (lib/journal-crypto). The crypto now runs
//      natively (react-native-quick-crypto), byte-compatible with the web app.
//   2. UNLOCKED / NOT ENCRYPTED → the date-grouped `JournalList` (features).
//   3. LOADING / ERROR / EMPTY → spinner / banner / empty copy.
//
// List sourcing mirrors the PWA journal-sidebar: the default view is the
// PAGINATED infinite query (20/page + "Load more"); applying a date-range
// filter switches to the filtered flat query; the mood filter is applied
// client-side after decryption. Filters live in JournalFilterSheet.
//
// Tapping an entry pushes to the `journal/[id]` detail route (decrypted title +
// a plain-text excerpt). Creation IS native — the FAB pushes the full-screen
// rich-text editor (journal/new.tsx), which renders the kit RichTextEditor
// (10tap) and encrypts with the in-memory DEK before saving.
//
// PWA parity (Phase 4d): decryption now runs INSIDE the data hooks' queryFn
// (useJournals / useJournalsPaginated, lib/api/hooks/journal.ts), not on the
// render path — `useJournals`/`useJournalsPaginated` already return plaintext.
// The query keys fold in `journalDekEpoch()`, so a lock/unlock produces a
// DIFFERENT cache entry and can never serve stale plaintext from the previous
// DEK. This screen no longer runs its own decrypt effect.

import {
  Banner,
  Button,
  EmptyState,
  FormSheet,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import { JournalList } from "@repo/features/journal";
import {
  PASSPHRASE_RECOVERY_COPY,
  PASSPHRASE_SETUP_COPY,
  PassphrasePrompt,
  PassphraseRecoveryForm,
  PassphraseSetupForm,
  type PassphraseRecoveryStep,
  type PassphraseSetupStep,
} from "@repo/features/encryption";
import type { Journal } from "@repo/core/types";
import { useUser } from "@stageholder/sdk/react-native";
import { SlidersHorizontal } from "@tamagui/lucide-icons-2/icons/SlidersHorizontal";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { CreateFab } from "@/components/create-fab";
import { JournalFilterSheet } from "@/components/journal-filter-sheet";
import { useStagedMount } from "@/lib/hooks/use-staged-mount";
import { useMountOnOpen } from "@/lib/hooks/use-mount-on-open";
import { withLazyTab } from "@/lib/hooks/use-lazy-tab";
import { FAB_CLEARANCE, ScreenScroll } from "@/components/screen-scroll";
import { IGNITION } from "@/lib/ignition-palette";
import { useJournals, useJournalsPaginated } from "@/lib/api";
import {
  checkJournalStatus,
  recoverJournalWithCodes,
  setupJournalPassphrase,
  unlockJournal,
  useJournalCrypto,
} from "@/lib/journal-crypto";

// Mounted on FIRST focus, not at launch — NativeTabs mounts every tab
// eagerly otherwise (see use-lazy-tab). Function hoisting lets the export
// sit above the definition.
export default withLazyTab(JournalScreen);

function JournalScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { isSetup, isUnlocked, isLoading: statusLoading } = useJournalCrypto();
  // Skeleton-first on the tab's first mount (matches todos/habits): paint the
  // header + a list skeleton on the tap frame; the real list fills in a beat
  // later. Preloading (use-warm-tabs) usually mounts this ahead of time, but
  // this keeps a very fast first tap instant too.
  const bodyMounted = useStagedMount();

  // ---- Filters (PWA journal-sidebar parity) ----
  // Date range switches the data source to the filtered flat query; mood is
  // applied client-side after decryption (mood is plaintext metadata, but the
  // list rows need decrypting either way).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moodFilter, setMoodFilter] = useState(0);

  const hasDateFilter = !!(startDate || endDate);
  const activeFilterCount =
    (hasDateFilter ? 1 : 0) + (moodFilter !== 0 ? 1 : 0);

  // Two independent From/To chips can produce an inverted range (From after
  // To) — normalize instead of sending the server a range that matches nothing.
  const dateParams = useMemo(() => {
    const [s, e] =
      startDate && endDate && startDate > endDate
        ? [endDate, startDate]
        : [startDate, endDate];
    const params: { startDate?: string; endDate?: string } = {};
    if (s) params.startDate = s;
    if (e) params.endDate = e;
    return params;
  }, [startDate, endDate]);

  // Default view = the paginated infinite list (20/page, "Load more");
  // date-filtered view = the flat filtered query. Only one is active at a
  // time — the flat query is disabled until a date filter is set.
  const dateRangeQuery = useJournals(dateParams, { enabled: hasDateFilter });
  const paginatedQuery = useJournalsPaginated();
  // First-time encryption setup wizard — the shared two-step form hosted in
  // a kit FormSheet (same host as the todo/habit create flows). `setupStep`
  // mirrors the form's internal step so the sheet's title/description swap
  // when the wizard advances to the recovery codes.
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<PassphraseSetupStep>("create");
  // Forgotten-passphrase recovery — reachable from the lock screen's
  // "Forgot passphrase?" link. Step mirrored so the sheet title swaps and
  // dismissal is blocked while the NEW codes are on screen.
  const [recoverOpen, setRecoverOpen] = useState(false);
  // Sheet hosts mount on FIRST open only (use-mount-on-open). Hooks sit above
  // the `locked` early return.
  const filtersHost = useMountOnOpen(filtersOpen);
  const setupHost = useMountOnOpen(setupOpen);
  const recoverHost = useMountOnOpen(recoverOpen);
  const [recoverStep, setRecoverStep] =
    useState<PassphraseRecoveryStep>("redeem");

  // Check encryption status once on mount (cheap GET; the unlock flow needs the
  // server's wrapped DEK + salt before it can derive anything).
  useEffect(() => {
    void checkJournalStatus();
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        checkJournalStatus(),
        hasDateFilter ? dateRangeQuery.refetch() : paginatedQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const locked = isSetup && !isUnlocked;

  // ---- Data is ALREADY DECRYPTED by the time it reaches this screen ----
  // useJournals / useJournalsPaginated decrypt inside their queryFn (Phase 4d,
  // PWA parity) — no render-path crypto here. `journals` just flattens the
  // active source's pages/rows; while `locked` this data is never rendered
  // (the early-return below shows PassphrasePrompt instead), so a stale
  // plaintext flash across a lock can't happen even though the query itself
  // keeps running.
  const journals = useMemo<Journal[]>(() => {
    if (hasDateFilter) return dateRangeQuery.data ?? [];
    const pages = paginatedQuery.data?.pages;
    if (!pages) return [];
    // Shape-guard each page (persisted-cache habit; journal queries aren't
    // persisted, but a malformed page must never crash the flatten).
    return pages.flatMap((p) => (Array.isArray(p?.data) ? p.data : []));
  }, [hasDateFilter, dateRangeQuery.data, paginatedQuery.data]);

  // Mood filter (client-side, PWA parity), then newest first (date desc,
  // then most-recently-updated).
  const sorted = useMemo(() => {
    const moodFiltered =
      moodFilter === 0
        ? journals
        : journals.filter((j) => j.mood === moodFilter);
    return [...moodFiltered].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [journals, moodFilter]);

  async function handleUnlock(passphrase: string) {
    // Throws on wrong passphrase — PassphrasePrompt catches it and shows the
    // "Wrong passphrase" message.
    await unlockJournal(passphrase);
  }

  // Native creation — push the full-screen rich-text editor route. Encryption
  // (when set up) happens inside the create mutation; the editor route guards
  // the locked case (can't encrypt without the DEK) by bouncing back here.
  function handleCreate() {
    router.push("/journal/new");
  }

  // ---- Locked: full-screen passphrase prompt (+ recovery flow) ----
  if (locked) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {/* The prompt centres itself in whatever height it gets, so padding
              the bottom by the keyboard height keeps the passphrase field
              (and Unlock) above the keys — the field was hidden behind the
              keyboard on autofocus before (2026-10-20). keyboard-controller's
              view tracks the keyboard frame on the UI thread (no RN
              KeyboardAvoidingView lag); the KeyboardProvider is in _layout. */}
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <PassphrasePrompt
              onUnlock={handleUnlock}
              onForgot={() => setRecoverOpen(true)}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Recovery — redeem saved codes + set a new passphrase, then the
            NEW codes show once (dismissal blocked on that step, like the
            setup wizard's). On completion the journal is unlocked with the
            recovered DEK. */}
        {recoverHost ? (
          <FormSheet
            hideFooter
            open={recoverOpen}
            onOpenChange={(open) => {
              if (!open && recoverStep === "newCodes") return;
              setRecoverOpen(open);
              if (!open) setRecoverStep("redeem");
            }}
            title={PASSPHRASE_RECOVERY_COPY[recoverStep].title}
            description={PASSPHRASE_RECOVERY_COPY[recoverStep].description}
          >
            <PassphraseRecoveryForm
              key={recoverOpen ? "open" : "closed"}
              onStepChange={setRecoverStep}
              onRecover={async (codes, newPassphrase) => {
                if (!user?.sub) throw new Error("Not signed in");
                return recoverJournalWithCodes(codes, newPassphrase, user.sub);
              }}
              onComplete={() => {
                setRecoverOpen(false);
                setRecoverStep("redeem");
                void checkJournalStatus();
              }}
            />
          </FormSheet>
        ) : null}
      </YStack>
    );
  }

  const activeQuery = hasDateFilter ? dateRangeQuery : paginatedQuery;
  const listLoading = activeQuery.isLoading || statusLoading;
  const listError = activeQuery.error;

  // Header count: the server total when unfiltered (the loaded pages may be a
  // subset), the visible count when any filter narrows the list.
  const entryCount =
    activeFilterCount > 0
      ? sorted.length
      : (paginatedQuery.data?.pages[0]?.meta?.total ?? sorted.length);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScreenScroll
          refreshing={refreshing}
          onRefresh={handleRefresh}
          bottomGap={FAB_CLEARANCE}
          onEndReached={() => {
            if (
              !hasDateFilter &&
              paginatedQuery.hasNextPage &&
              !paginatedQuery.isFetchingNextPage
            ) {
              void paginatedQuery.fetchNextPage();
            }
          }}
        >
          <YStack gap="$4" px="$4" pt="$4" pb="$10">
            <XStack items="flex-start" justify="space-between" gap="$3">
              <YStack gap="$0.5" flex={1} minW={0}>
                <Text fontSize="$8" fontWeight="700" color="$color">
                  Journal
                </Text>
                {!listLoading && sorted.length > 0 ? (
                  <Text fontSize="$2" color="$mutedForeground">
                    {entryCount} {entryCount === 1 ? "entry" : "entries"}
                  </Text>
                ) : null}
              </YStack>
              {/* Filter — trigger label carries the active count so the
                  collapsed control still signals filters are applied
                  (PWA parity). */}
              <Button
                intent="outline"
                size="sm"
                icon={<SlidersHorizontal size={14} />}
                onPress={() => setFiltersOpen(true)}
              >
                {activeFilterCount > 0
                  ? `Filter (${activeFilterCount})`
                  : "Filter"}
              </Button>
            </XStack>

            {/* Encryption not set up yet → offer to set a passphrase. Mirrors
                the PWA's SetupBanner. Hidden once isSetup flips true. */}
            {!isSetup && !statusLoading ? (
              <Banner intent="info">
                <Banner.Body>
                  <Banner.Title>Encrypt your journal</Banner.Title>
                  <Banner.Description>
                    Set a passphrase so only you can read your entries.
                    You&apos;ll get one-time recovery codes to save.
                  </Banner.Description>
                  {/* Inside Body (not a row sibling) so the text keeps the
                      full width and the CTA sits bottom-right — the standard
                      mobile banner layout. */}
                  <Banner.Action self="flex-end" mt="$2">
                    <Button
                      intent="primary"
                      size="sm"
                      onPress={() => setSetupOpen(true)}
                    >
                      Set up encryption
                    </Button>
                  </Banner.Action>
                </Banner.Body>
              </Banner>
            ) : null}

            {/* Error */}
            {listError ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load entries</Banner.Title>
                  <Banner.Description>
                    {(listError as Error).message ?? "Network error."}
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

            {/* Loading — first fetch / first decrypt, before any rows. ONE
                skeleton for both the staged-mount beat and the query wait:
                the first open used to paint the list skeleton, swap to a
                centred spinner while the lock status + first page loaded,
                then the rows — three different frames that read as two
                blinks. Later opens hit the cache and never showed either. */}
            {!bodyMounted || (listLoading && sorted.length === 0) ? (
              <JournalList journals={[]} isLoading />
            ) : !listError && sorted.length === 0 ? (
              /* Empty — distinguish "no entries at all" from "filters matched
                 nothing" so an active filter never reads like data loss. */
              activeFilterCount > 0 ? (
                <EmptyState>
                  <EmptyState.IconSlot>
                    <Text fontSize={28}>✎</Text>
                  </EmptyState.IconSlot>
                  <EmptyState.Title>No matching entries</EmptyState.Title>
                  <EmptyState.Description>
                    Nothing matches the current filters. Adjust or clear them to
                    see your entries.
                  </EmptyState.Description>
                  <EmptyState.Actions>
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={() => {
                        setStartDate("");
                        setEndDate("");
                        setMoodFilter(0);
                      }}
                    >
                      Clear filters
                    </Button>
                  </EmptyState.Actions>
                </EmptyState>
              ) : (
                <EmptyState>
                  <EmptyState.IconSlot>
                    <Text fontSize={28}>✎</Text>
                  </EmptyState.IconSlot>
                  <EmptyState.Title>No entries yet</EmptyState.Title>
                  <EmptyState.Description>
                    Your reflections will appear here.
                  </EmptyState.Description>
                  <EmptyState.Actions>
                    <Button intent="primary" size="sm" onPress={handleCreate}>
                      Write your first entry
                    </Button>
                  </EmptyState.Actions>
                </EmptyState>
              )
            ) : (
              /* List — date-grouped, tap to read */
              <>
                <JournalList
                  journals={sorted}
                  onJournalPress={(id) => router.push(`/journal/${id}`)}
                />
                {/* Infinite scroll footer (paginated view only — a
                    date-filtered list is already the complete match set). */}
                {!hasDateFilter && paginatedQuery.isFetchingNextPage ? (
                  <XStack justify="center" py="$3">
                    <Spinner />
                  </XStack>
                ) : null}
              </>
            )}
          </YStack>
        </ScreenScroll>
      </SafeAreaView>

      {/* Native creation — pushes the full-screen rich-text editor route.
          CreateFab mirrors the PWA's: lifted above the capsule, journal-yellow
          tint. */}
      <CreateFab
        label="New journal entry"
        testID="fab-new-journal"
        tint={IGNITION.journal.base}
        onPress={handleCreate}
      />

      {/* Filters — date range + mood, applied live (PWA sidebar's Filter
          popover, rebuilt as a native sheet). */}
      {/* Host mounted on first open only (use-mount-on-open). */}
      {filtersHost ? (
        <JournalFilterSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          startDate={startDate}
          endDate={endDate}
          mood={moodFilter}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onMoodChange={setMoodFilter}
        />
      ) : null}

      {/* First-time encryption setup — collects a passphrase, then shows the
          recovery codes. onSetup runs the native key ceremony + POSTs to
          /journal-security/setup; on completion we re-check status so the
          banner disappears and new entries encrypt. The form renders its own
          Cancel/submit actions, so the kit footer is hidden; the form
          re-mounts on each open (`key`) so it resets by remount. */}
      {setupHost ? (
        <FormSheet
          hideFooter
          open={setupOpen}
          onOpenChange={(open) => {
            // Once recovery codes are showing, only the Done button may close
            // the sheet (overlay taps ignored) — dismissing mid-step would lose
            // the codes forever.
            if (!open && setupStep === "recovery") return;
            setSetupOpen(open);
            if (!open) setSetupStep("create");
          }}
          title={PASSPHRASE_SETUP_COPY[setupStep].title}
          description={PASSPHRASE_SETUP_COPY[setupStep].description}
        >
          <PassphraseSetupForm
            key={setupOpen ? "open" : "closed"}
            onStepChange={setSetupStep}
            onSetup={async (passphrase) => {
              if (!user?.sub) throw new Error("Not signed in");
              return setupJournalPassphrase(passphrase, user.sub);
            }}
            onSetupError={() => toast.error("Couldn't set up encryption")}
            onComplete={() => {
              setSetupOpen(false);
              setSetupStep("create");
              void checkJournalStatus();
            }}
          />
        </FormSheet>
      ) : null}
    </YStack>
  );
}
