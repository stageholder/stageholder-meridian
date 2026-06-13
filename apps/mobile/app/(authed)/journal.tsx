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
  FormSheet,
  PullToRefresh,
  Spinner,
  Text,
  View,
  YStack,
  useToast,
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
  recoverJournalWithCodes,
  setupJournalPassphrase,
  unlockJournal,
  useJournalCrypto,
} from "@/lib/journal-crypto";

export default function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useUser();
  const journalsQuery = useJournals();
  const { isSetup, isUnlocked, isLoading: statusLoading } = useJournalCrypto();
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

  // ---- Locked: full-screen passphrase prompt (+ recovery flow) ----
  if (locked) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <PassphrasePrompt
            onUnlock={handleUnlock}
            onForgot={() => setRecoverOpen(true)}
          />
        </SafeAreaView>

        {/* Recovery — redeem saved codes + set a new passphrase, then the
            NEW codes show once (dismissal blocked on that step, like the
            setup wizard's). On completion the journal is unlocked with the
            recovered DEK. */}
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
          // `contentContainerStyle` exists only on the .native variant; tsc
          // resolves the web types, so it rides a spread cast.
          {...({
            contentContainerStyle: {
              paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
            },
          } as object)}
        >
          <YStack gap="$4" px="$4" pt="$4" pb="$10">
            <YStack gap="$0.5">
              <Text fontSize="$8" fontWeight="700" color="$color">
                Journal
              </Text>
              {!listLoading && sorted.length > 0 ? (
                <Text fontSize="$2" color="$mutedForeground">
                  {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
                </Text>
              ) : null}
            </YStack>

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
            {journalsQuery.error ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load entries</Banner.Title>
                  <Banner.Description>
                    {(journalsQuery.error as Error).message ?? "Network error."}
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

      {/* First-time encryption setup — collects a passphrase, then shows the
          recovery codes. onSetup runs the native key ceremony + POSTs to
          /journal-security/setup; on completion we re-check status so the
          banner disappears and new entries encrypt. The form renders its own
          Cancel/submit actions, so the kit footer is hidden; the form
          re-mounts on each open (`key`) so it resets by remount. */}
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
          onSetupError={() =>
            toast.show({
              title: "Couldn't set up encryption",
              intent: "danger",
            })
          }
          onComplete={() => {
            setSetupOpen(false);
            setSetupStep("create");
            void checkJournalStatus();
          }}
        />
      </FormSheet>
    </YStack>
  );
}
