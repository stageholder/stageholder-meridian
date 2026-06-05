// apps/mobile/app/(authed)/journal/[id].tsx
//
// Journal entry detail — read-only. Decrypts the entry with the in-memory DEK
// (held in lib/journal-crypto) and shows its title, date · mood · word count,
// and a PLAIN-TEXT excerpt extracted from the TipTap-JSON content.
//
// Deliberately NOT a rich renderer: the TipTap / 10tap editor stack stays a
// web-only concern this pass. We walk the content tree collecting text nodes
// (extractPlainText) so the reader gets the gist without pulling the editor
// onto mobile. A footer note points to the web app for full rich reading +
// editing.
//
// This route lives under the journal tab's stack but is hidden from the tab bar
// via `href: null` in (authed)/_layout.tsx. If the journal is locked (no DEK)
// we bounce the reader back — the list screen owns the unlock flow.

import {
  Banner,
  Button,
  H1,
  Paragraph,
  ScrollView,
  Separator,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { ChevronLeft } from "@tamagui/lucide-icons-2";
// MoodDisplay isn't a kit export — it ships from the features journal barrel
// (read-only emoji built on the kit's MOOD_DEFAULT_OPTIONS).
import { MoodDisplay } from "@repo/features/journal";
import type { Journal } from "@repo/core/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useJournal } from "@/lib/api";
import {
  decryptJournalEntry,
  extractPlainText,
  getJournalDek,
  journalWordCount,
  useJournalCrypto,
} from "@/lib/journal-crypto";

function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journalQuery = useJournal(id);
  const { isUnlocked } = useJournalCrypto();

  // `entry` is the decrypted journal (or the raw one when unencrypted). We
  // decrypt in an effect because decryption is async + depends on the DEK.
  const [entry, setEntry] = useState<Journal | null>(null);
  const [decryptError, setDecryptError] = useState(false);

  const raw = journalQuery.data;

  useEffect(() => {
    let cancelled = false;
    setDecryptError(false);
    if (!raw) {
      setEntry(null);
      return;
    }
    if (!raw.encrypted) {
      setEntry(raw);
      return;
    }
    const dek = getJournalDek();
    if (!dek) {
      // Locked — can't read this entry. Leave `entry` null; the render branch
      // sends the reader back to unlock on the list.
      setEntry(null);
      return;
    }
    decryptJournalEntry(raw, dek)
      .then((e) => {
        if (!cancelled) setEntry(e);
      })
      .catch(() => {
        if (!cancelled) setDecryptError(true);
      });
    return () => {
      cancelled = true;
    };
    // isUnlocked in deps so a mid-screen unlock re-runs decryption.
  }, [raw, isUnlocked]);

  // Headers are hidden globally by the Tabs layout's screenOptions, so this
  // detail screen draws its own lightweight back bar instead of a nav header.
  const backBar = (
    <XStack px="$2" py="$2">
      <Button
        intent="ghost"
        size="sm"
        icon={<ChevronLeft size={18} />}
        onPress={() => router.back()}
      >
        Journal
      </Button>
    </XStack>
  );

  // ---- Loading ----
  if (journalQuery.isLoading) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {backBar}
          <View flex={1} items="center" justify="center">
            <Spinner size="large" />
          </View>
        </SafeAreaView>
      </YStack>
    );
  }

  // ---- Error (fetch or decrypt) ----
  if (journalQuery.error || decryptError) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {backBar}
          <YStack px="$4" pt="$2">
            <Banner intent="danger">
              <Banner.Title>Couldn&apos;t open this entry</Banner.Title>
              <Banner.Description>
                {decryptError
                  ? "This entry couldn't be decrypted with the current key."
                  : ((journalQuery.error as Error)?.message ??
                    "Network error.")}
              </Banner.Description>
            </Banner>
          </YStack>
        </SafeAreaView>
      </YStack>
    );
  }

  // ---- Locked / not yet decrypted ----
  // raw is encrypted but we have no DEK → prompt the reader to unlock on the
  // list. (We don't render the prompt here to keep the unlock flow in one place.)
  if (raw?.encrypted && !entry) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {backBar}
          <YStack px="$4" pt="$2" gap="$3">
            <Banner intent="neutral">
              <Banner.Title>Journal locked</Banner.Title>
              <Banner.Description>
                Unlock your journal from the list to read this entry.
              </Banner.Description>
              <Banner.Action>
                <Button
                  intent="secondary"
                  size="sm"
                  onPress={() => router.push("/journal")}
                >
                  Go to journal
                </Button>
              </Banner.Action>
            </Banner>
          </YStack>
        </SafeAreaView>
      </YStack>
    );
  }

  if (!entry) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {backBar}
          <View flex={1} items="center" justify="center">
            <Spinner size="large" />
          </View>
        </SafeAreaView>
      </YStack>
    );
  }

  const dateLabel = parseDateLocal(entry.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const words = journalWordCount(entry);
  const excerpt = extractPlainText(entry.content);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {backBar}
        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$4" px="$4" pt="$2" pb="$10">
            <YStack gap="$2">
              <H1 fontSize="$8" fontWeight="700" color="$color">
                {entry.title}
              </H1>
              <XStack items="center" gap="$2" flexWrap="wrap">
                <Text fontSize="$2" color="$mutedForeground">
                  {dateLabel}
                </Text>
                {entry.mood ? (
                  <>
                    <Text fontSize="$2" color="$mutedForeground">
                      ·
                    </Text>
                    <MoodDisplay mood={entry.mood} />
                  </>
                ) : null}
                {words > 0 ? (
                  <>
                    <Text fontSize="$2" color="$mutedForeground">
                      ·
                    </Text>
                    <Text fontSize="$2" color="$mutedForeground">
                      {words} words
                    </Text>
                  </>
                ) : null}
              </XStack>
            </YStack>

            <Separator />

            {excerpt ? (
              <Paragraph fontSize="$4" lineHeight="$5" color="$color">
                {excerpt}
              </Paragraph>
            ) : (
              <Text fontSize="$3" color="$mutedForeground">
                This entry has no text content.
              </Text>
            )}

            {/* Honest footer — formatting + editing are web-only this pass. */}
            <View pt="$4">
              <Text fontSize="$1" color="$mutedForeground">
                Showing a plain-text preview. Open the web app for full
                formatting and editing.
              </Text>
            </View>
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
