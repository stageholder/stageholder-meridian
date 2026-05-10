// apps/mobile/app/(authed)/journal.tsx
//
// Full Journal screen. DateStrip at the top to navigate days; below, the
// entries for that day stacked. New entries via FAB. Each entry edits in
// place with autosave; nothing to "save" — leaving the screen is fine.

import {
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  Text,
  YStack,
} from "@stageholder/ui";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateStrip } from "@/components/journal/DateStrip";
import { EntryEditor } from "@/components/journal/EntryEditor";
import { useJournal } from "@/lib/stores/journal";
import { dateKey } from "@/lib/types";

export default function JournalScreen() {
  const [activeDay, setActiveDay] = useState<string>(dateKey());
  const { entries, add, dailyTarget, wordsOn } = useJournal();

  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.dateKey === activeDay)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries, activeDay],
  );
  const totalWords = wordsOn(activeDay);

  function newEntry() {
    add({ dateKey: activeDay, body: "" });
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
                {activeDay === dateKey()
                  ? "Quiet today"
                  : "Nothing on this day"}
              </EmptyState.Title>
              <EmptyState.Description>
                {activeDay === dateKey()
                  ? "Tap + to capture how you're feeling. Thoughts. Wins. Things to remember."
                  : "Use the date strip to find a day with entries, or tap + to backfill."}
              </EmptyState.Description>
              <EmptyState.Actions>
                <Button onPress={newEntry}>New entry</Button>
              </EmptyState.Actions>
            </EmptyState>
          ) : (
            <YStack gap="$3">
              {dayEntries.map((e) => (
                <EntryEditor
                  key={e.id}
                  entry={e}
                  dailyTarget={dailyTarget}
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
