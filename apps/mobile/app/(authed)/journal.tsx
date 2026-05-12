// apps/mobile/app/(authed)/journal.tsx
//
// Two views via SegmentedControl: Day / Browse. Mirrors the PWA's journal
// surfaces (apps/pwa/app/app/journal/* + apps/pwa/components/journal/journal-sidebar.tsx):
//
//   - Day:    DateStrip + that day's stacked editors (current behavior)
//   - Browse: chronological list of all entries with mood filter chips
//
// Browse rows are tappable — tapping one jumps to Day view focused on
// that entry's date.

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  SegmentedControl,
  Separator,
  Text,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Journal } from "@repo/core/types";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateStrip } from "@/components/journal/DateStrip";
import { EntryEditor } from "@/components/journal/EntryEditor";
import {
  extractServerMessage,
  useCreateJournal,
  useJournals,
  useUserLight,
} from "@/lib/api";
import { fromDateKey, localDateKey } from "@/lib/streak";

// Fallback when userLight hasn't loaded yet; real value lives on the
// /light/me payload and is editable from Profile.
const DEFAULT_WORD_TARGET = 200;

const MOOD_FILTER_OPTIONS = [
  { value: 0, label: "All" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const MOOD_EMOJI: Record<number, string> = {
  1: "😖",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

type ViewMode = "day" | "browse";

export default function JournalScreen() {
  const [mode, setMode] = useState<ViewMode>("day");
  const [activeDay, setActiveDay] = useState<string>(localDateKey());
  const [moodFilter, setMoodFilter] = useState<number>(0);

  // Day view: only fetch the active day's entries (cheap, fast).
  const dayQuery = useJournals({ startDate: activeDay, endDate: activeDay });
  // Browse view: fetch all entries (no filter param — server returns latest).
  // The PWA paginates this; mobile can switch to paginated later if needed.
  const allQuery = useJournals();
  const lightQuery = useUserLight();
  const dailyTarget =
    lightQuery.data?.journalTargetDailyWords ?? DEFAULT_WORD_TARGET;
  const create = useCreateJournal();
  const toast = useToast();

  const dayEntries = useMemo(
    () =>
      (dayQuery.data ?? [])
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [dayQuery.data],
  );
  const totalWords = useMemo(
    () => dayEntries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0),
    [dayEntries],
  );

  const allEntries = useMemo(() => {
    const list = (allQuery.data ?? [])
      .slice()
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
    return moodFilter === 0 ? list : list.filter((e) => e.mood === moodFilter);
  }, [allQuery.data, moodFilter]);

  function actuallyCreate() {
    create.mutate(
      { content: "", date: activeDay },
      {
        onError: (err) => {
          toast.show({
            title: "Couldn't create entry",
            // Surface the NestJS validation message ("Title is required",
            // "Date must be in YYYY-MM-DD format", etc.) — falls back to
            // Axios's generic "Request failed with status code 400" only
            // when the server didn't return a structured body.
            message:
              extractServerMessage(err) ??
              (err as Error).message ??
              "Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  function newEntry() {
    if (dayEntries.length > 0) {
      Alert.alert(
        "Add another entry?",
        `This day already has ${dayEntries.length} ${
          dayEntries.length === 1 ? "entry" : "entries"
        }. Adding another will appear above the existing one.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add", onPress: actuallyCreate },
        ],
      );
    } else {
      actuallyCreate();
    }
  }

  function jumpToEntry(entry: Journal) {
    setActiveDay(entry.date.slice(0, 10));
    setMode("day");
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
              {mode === "day"
                ? dayEntries.length > 0
                  ? `${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"} · ${totalWords} words`
                  : "Daily reflection"
                : `${allEntries.length} ${allEntries.length === 1 ? "entry" : "entries"}`}
            </Paragraph>
            <H3 color="$color12">Journal</H3>
          </YStack>

          <SegmentedControl
            value={mode}
            onValueChange={(v) => setMode(v as ViewMode)}
            fullWidth
          >
            <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
            <SegmentedControl.Item value="browse">Browse</SegmentedControl.Item>
          </SegmentedControl>

          {mode === "day" ? (
            <DateStrip value={activeDay} onChange={setActiveDay} />
          ) : (
            <XStack gap="$1.5" flexWrap="wrap">
              {MOOD_FILTER_OPTIONS.map((opt) => {
                const active = moodFilter === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setMoodFilter(opt.value)}
                  >
                    <XStack
                      px="$2.5"
                      py="$1"
                      rounded="$3"
                      bg={(active ? "$color5" : "$color3") as never}
                      borderWidth={1}
                      borderColor={(active ? "$color9" : "$color6") as never}
                      items="center"
                      gap={4}
                    >
                      {opt.value > 0 ? (
                        <Text fontSize={12}>{MOOD_EMOJI[opt.value]}</Text>
                      ) : null}
                      <Text fontSize="$1" color="$color12">
                        {opt.label}
                      </Text>
                    </XStack>
                  </Pressable>
                );
              })}
            </XStack>
          )}

          {(mode === "day" ? dayQuery.error : allQuery.error) ? (
            <Banner intent="danger">
              <Banner.Title>Couldn't load entries</Banner.Title>
              <Banner.Description>
                {((mode === "day" ? dayQuery.error : allQuery.error) as Error)
                  .message ?? "Network error."}
              </Banner.Description>
              <XStack pt="$2">
                <Button
                  intent="secondary"
                  size="$2"
                  onPress={() =>
                    mode === "day" ? dayQuery.refetch() : allQuery.refetch()
                  }
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
          {mode === "day" ? (
            dayEntries.length === 0 ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={24}>✎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>
                  {dayQuery.isLoading
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
                {dayEntries.map((e) => (
                  <EntryEditor
                    key={e.id}
                    entry={e}
                    dailyTarget={dailyTarget}
                    dayTotalWords={totalWords}
                  />
                ))}
              </YStack>
            )
          ) : allEntries.length === 0 ? (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text fontSize={24}>✎</Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>
                {allQuery.isLoading
                  ? "Loading…"
                  : moodFilter === 0
                    ? "No entries yet"
                    : "No entries match this mood"}
              </EmptyState.Title>
              <EmptyState.Description>
                {moodFilter === 0
                  ? "Start writing in Day view."
                  : "Try a different mood filter or clear it."}
              </EmptyState.Description>
            </EmptyState>
          ) : (
            <YStack>
              {allEntries.map((e, i) => (
                <YStack key={e.id}>
                  {i > 0 ? <Separator /> : null}
                  <BrowseRow entry={e} onPress={() => jumpToEntry(e)} />
                </YStack>
              ))}
            </YStack>
          )}
        </ScrollView>
      </SafeAreaView>

      {mode === "day" ? (
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
      ) : null}
    </YStack>
  );
}

function BrowseRow({
  entry,
  onPress,
}: {
  entry: Journal;
  onPress: () => void;
}) {
  const dateLabel = fromDateKey(entry.date.slice(0, 10)).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  );
  const moodGlyph = entry.mood ? MOOD_EMOJI[entry.mood] : null;
  const snippet = (entry.content ?? "").trim().slice(0, 120);

  return (
    <Pressable onPress={onPress}>
      <YStack py="$3" gap={4}>
        <XStack justify="space-between" items="center">
          <XStack items="center" gap="$2" flex={1}>
            {moodGlyph ? <Text fontSize="$3">{moodGlyph}</Text> : null}
            <Text
              fontSize="$3"
              fontWeight="600"
              color="$color12"
              numberOfLines={1}
              flex={1}
            >
              {entry.title?.trim() || dateLabel}
            </Text>
          </XStack>
          <Text fontSize="$1" color="$color11" fontFamily="$mono">
            {entry.wordCount ?? 0}w
          </Text>
        </XStack>
        <Text fontSize="$1" color="$color11">
          {entry.title?.trim() ? dateLabel : ""}
        </Text>
        {snippet ? (
          <Paragraph fontSize="$2" color="$color11" numberOfLines={2}>
            {snippet}
            {(entry.content ?? "").length > snippet.length ? "…" : ""}
          </Paragraph>
        ) : null}
      </YStack>
    </Pressable>
  );
}
