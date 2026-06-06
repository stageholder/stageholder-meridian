// apps/mobile/app/(authed)/journal.tsx
//
// Journal — encryption-aware list. Three states:
//
//   1. LOCKED   (encryption set up, DEK not in memory) → PassphrasePrompt.
//      Unlocking derives the master key from the passphrase + server salt and
//      unwraps the DEK into memory (lib/journal-crypto). The crypto now runs
//      natively (react-native-quick-crypto), byte-compatible with the web app.
//   2. UNLOCKED / NOT ENCRYPTED → the date-grouped `JournalList` (features),
//      with each entry decrypted client-side for its title + preview.
//   3. LOADING / ERROR / EMPTY → spinner / banner / empty copy.
//
// Tapping an entry pushes to the `journal/[id]` detail route (decrypted title +
// a plain-text excerpt). Creation IS native — the FAB pushes the full-screen
// rich-text editor (journal/new.tsx), which renders the kit RichTextEditor
// (10tap) and encrypts with the in-memory DEK before saving.
//
// We decrypt at the SCREEN level (not in the data hook like the PWA) because
// the mobile journal hooks return raw, possibly-encrypted journals. The DEK is
// held in the shared journal-crypto store, so decryption re-runs whenever the
// raw list or the unlock state changes.

import {
  Banner,
  Button,
  EmptyState,
  PullToRefresh,
  Spinner,
  Text,
  View,
  YStack,
} from "@stageholder/ui";
import { JournalList } from "@repo/features/journal";
import { PassphrasePrompt } from "@repo/features/encryption";
import type { Journal } from "@repo/core/types";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CreateFab } from "@/components/create-fab";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { IGNITION } from "@/lib/ignition-palette";
import { useJournals } from "@/lib/api";
import {
  checkJournalStatus,
  decryptJournalList,
  getJournalDek,
  unlockJournal,
  useJournalCrypto,
} from "@/lib/journal-crypto";

export default function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const journalsQuery = useJournals();
  const { isSetup, isUnlocked, isLoading: statusLoading } = useJournalCrypto();

  // Check encryption status once on mount (cheap GET; the unlock flow needs the
  // server's wrapped DEK + salt before it can derive anything).
  useEffect(() => {
    void checkJournalStatus();
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([checkJournalStatus(), journalsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const locked = isSetup && !isUnlocked;

  // ---- Decrypt the list whenever raw data or unlock state changes ----
  // `decrypted` holds the post-decrypt journals; while a decrypt is in flight
  // we keep `decrypting` true so the list shows a spinner instead of flashing
  // ciphertext titles. When not encrypted, the raw list passes straight through.
  const rawJournals = useMemo(
    () => journalsQuery.data ?? [],
    [journalsQuery.data],
  );
  const [decrypted, setDecrypted] = useState<Journal[]>([]);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Locked → nothing to show (the prompt renders instead). Avoid touching the
    // ciphertext at all so a stale `decrypted` list never leaks across a lock.
    if (locked) {
      setDecrypted([]);
      return;
    }
    const dek = getJournalDek();
    // No DEK (encryption not set up, or plaintext account) → pass through.
    if (!dek) {
      setDecrypted(rawJournals);
      return;
    }
    setDecrypting(true);
    decryptJournalList(rawJournals, dek)
      .then((list) => {
        if (!cancelled) setDecrypted(list);
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rawJournals, locked, isUnlocked]);

  // Newest first (date desc, then most-recently-updated).
  const sorted = useMemo(
    () =>
      [...decrypted].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
    [decrypted],
  );

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

  // ---- Locked: full-screen passphrase prompt ----
  if (locked) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <PassphrasePrompt onUnlock={handleUnlock} />
        </SafeAreaView>
      </YStack>
    );
  }

  const listLoading = journalsQuery.isLoading || statusLoading || decrypting;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* PullToRefresh.native is the scroller — its child is the padded
            content column, not a nested ScrollView. */}
        <PullToRefresh
          refreshing={refreshing}
          onRefresh={handleRefresh}
          // Clearance for the floating BottomNav capsule (PWA shell parity).
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$4" px="$4" pt="$4" pb="$10">
            <Text fontSize="$8" fontWeight="700" color="$color">
              Journal
            </Text>

            {/* Error */}
            {journalsQuery.error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn&apos;t load entries</Banner.Title>
                <Banner.Description>
                  {(journalsQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
                <Banner.Action>
                  <Button intent="secondary" size="sm" onPress={handleRefresh}>
                    Try again
                  </Button>
                </Banner.Action>
              </Banner>
            ) : null}

            {/* Loading — first fetch / first decrypt, before any rows. */}
            {listLoading && sorted.length === 0 ? (
              <View py="$10" items="center" justify="center">
                <Spinner size="large" />
              </View>
            ) : !journalsQuery.error && sorted.length === 0 ? (
              /* Empty */
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={28}>✎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>No entries yet</EmptyState.Title>
                <EmptyState.Description>
                  Your reflections will appear here. Write your first entry on
                  the web app to get started.
                </EmptyState.Description>
              </EmptyState>
            ) : (
              /* List — date-grouped, tap to read */
              <JournalList
                journals={sorted}
                onJournalPress={(id) => router.push(`/journal/${id}`)}
              />
            )}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      {/* Native creation — pushes the full-screen rich-text editor route.
          CreateFab mirrors the PWA's: lifted above the capsule, journal-yellow
          tint. */}
      <CreateFab
        label="New journal entry"
        tint={IGNITION.journal.base}
        onPress={handleCreate}
      />
    </YStack>
  );
}
