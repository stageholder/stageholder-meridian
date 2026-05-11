// apps/mobile/app/(authed)/journal.tsx
//
// Date-navigated journal. DateStrip lets the user walk back through prior
// days; each day's entries come from useJournals filtered to that one
// day. Tap + to create a new empty entry on the active day — the editor
// autosaves as the user types.

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  Text,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Journal } from "@repo/core/types";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateStrip } from "@/components/journal/DateStrip";
import { EntryEditor } from "@/components/journal/EntryEditor";
import { useCreateJournal, useJournals } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const DAILY_WORD_TARGET = 200;

export default function JournalScreen() {
  const [activeDay, setActiveDay] = useState<string>(localDateKey());
  const journalsQuery = useJournals({
    startDate: activeDay,
    endDate: activeDay,
  });
  const create = useCreateJournal();
  const toast = useToast();

  const entries = journalsQuery.data ?? [];
  const dayEntries = useMemo(
    () => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries],
  );
  const totalWords = useMemo(
    () => dayEntries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0),
    [dayEntries],
  );

  function newEntry() {
    create.mutate(
      { content: "", date: activeDay },
      {
        onError: (err) => {
          toast.show({
            title: "Couldn't create entry",
            message: (err as Error).message ?? "Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <YStack gap="$3" pt="$4" px="$5">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={11}
              letterSpacing={2}
              textTransform="uppercase"
              color="$color11"
            >
              Daily reflection
            </Paragraph>
            <H3 color="$color12">Journal</H3>
          </YStack>
          <DateStrip value={activeDay} onChange={setActiveDay} />
          {journalsQuery.error ? (
            <Banner intent="danger">
              <Banner.Title>Couldn't load entries</Banner.Title>
              <Banner.Description>
                {(journalsQuery.error as Error).message ?? "Network error."}
              </Banner.Description>
              <XStack pt="$2">
                <Button
                  intent="secondary"
                  size="$2"
                  onPress={() => journalsQuery.refetch()}
                >
                  Try again
                </Button>
              </XStack>
            </Banner>
          ) : null}
        </YStack>

        <ScrollView
          style={{ flex: 1, marginTop: 12 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {dayEntries.length === 0 ? (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text fontSize={24}>✎</Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>
                {journalsQuery.isLoading
                  ? "Loading…"
                  : activeDay === localDateKey()
                    ? "Quiet today"
                    : "Nothing on this day"}
              </EmptyState.Title>
              <EmptyState.Description>
                {activeDay === localDateKey()
                  ? "Tap + to capture how you're feeling. Thoughts. Wins. Things to remember."
                  : "Use the date strip to find a day with entries, or tap + to backfill."}
              </EmptyState.Description>
              <EmptyState.Actions>
                <Button onPress={newEntry} disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "New entry"}
                </Button>
              </EmptyState.Actions>
            </EmptyState>
          ) : (
            <YStack gap="$3">
              {dayEntries.map((e: Journal) => (
                <EntryEditor
                  key={e.id}
                  entry={e}
                  dailyTarget={DAILY_WORD_TARGET}
                  dayTotalWords={totalWords}
                />
              ))}
            </YStack>
          )}
        </ScrollView>
      </SafeAreaView>

      <FAB
        icon={
          <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
            +
          </Text>
        }
        placement="bottom-right"
        b={88}
        onPress={newEntry}
      />
    </YStack>
  );
}
