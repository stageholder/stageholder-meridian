// apps/mobile/app/(authed)/habits.tsx
//
// Live Habits screen. List of HabitCards (each one self-loads its entries
// for streak math). A DateStrip at the top lets the user navigate the
// week — habits filter to "scheduled on this day", which is most useful
// when the user is planning ahead ("what's my Tuesday look like?") or
// checking a specific past day's schedule. Check-in actions still target
// today (HabitCard's own logic); the strip only filters which cards
// appear.

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  Paragraph,
  PullToRefresh,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import { useMemo, useState } from "react";
import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddHabitSheet } from "@/components/habits/AddHabitSheet";
import { EditHabitSheet } from "@/components/habits/EditHabitSheet";
import { HabitCard } from "@/components/habits/HabitCard";
import { SearchableHeader } from "@/components/shared/SearchableHeader";
import { useHabits } from "@/lib/api";
import { fromDateKey, isScheduledToday, localDateKey } from "@/lib/streak";

export default function HabitsScreen() {
  const habitsQuery = useHabits();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(localDateKey());
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await habitsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const habits = habitsQuery.data ?? [];
  const selectedDateObj = fromDateKey(selectedDate);

  // Filter to habits scheduled on the SELECTED day-of-week. When the
  // selected date is today this collapses to "scheduled today" — the
  // original behavior — so the strip is additive, not disruptive.
  const filtered = useMemo(
    () =>
      habits.filter((h) => isScheduledToday(h.scheduledDays, selectedDateObj)),
    [habits, selectedDateObj],
  );

  // Text search runs on top of the day filter. Lowercase-once for hot loops.
  const q = query.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!q) return filtered;
    return filtered.filter((h) => h.name.toLowerCase().includes(q));
  }, [filtered, q]);

  const sorted = useMemo(() => {
    return [...searched].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [searched]);

  const scheduledCount = filtered.length;
  const isToday = selectedDate === localDateKey();

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          <YStack gap="$4" px="$5" pt="$4" pb={96}>
            <SearchableHeader
              title="Habits"
              subtitle={
                habits.length === 0
                  ? "No habits yet"
                  : scheduledCount === 0
                    ? "Nothing on this day"
                    : `${scheduledCount} scheduled ${isToday ? "today" : "this day"}`
              }
              query={query}
              onQueryChange={setQuery}
              open={searchOpen}
              onOpenChange={setSearchOpen}
              placeholder="Search habits…"
            />

            {habits.length > 0 && !searchOpen ? (
              <HabitsDateStrip
                value={selectedDate}
                onChange={setSelectedDate}
              />
            ) : null}

            {habitsQuery.error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn't load habits</Banner.Title>
                <Banner.Description>
                  {(habitsQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
                <XStack pt="$2">
                  <Button intent="secondary" size="$2" onPress={handleRefresh}>
                    Try again
                  </Button>
                </XStack>
              </Banner>
            ) : null}

            {!habitsQuery.error && habits.length === 0 ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={24}>◎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>
                  {habitsQuery.isLoading ? "Loading…" : "No habits yet"}
                </EmptyState.Title>
                <EmptyState.Description>
                  Add a daily ritual you want to keep — a walk, a few pages, ten
                  minutes of stillness. The streak takes care of itself.
                </EmptyState.Description>
                <EmptyState.Actions>
                  <Button onPress={() => setAddOpen(true)}>
                    Add first habit
                  </Button>
                </EmptyState.Actions>
              </EmptyState>
            ) : (
              sorted.map((h: Habit) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  onEdit={(habit) => setEditId(habit.id)}
                />
              ))
            )}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      <FAB
        icon={
          <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
            +
          </Text>
        }
        position="absolute"
        right={24}
        bottom={88}
        onPress={() => setAddOpen(true)}
      />

      <AddHabitSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <EditHabitSheet
        open={!!editId}
        habit={habits.find((h) => h.id === editId) ?? null}
        onClose={() => setEditId(null)}
      />
    </YStack>
  );
}

// ─── Inline date strip ──────────────────────────────────────────────────────
// Same affordance as the journal screen's DateStrip but local to habits.
// Deliberately not extracted to a shared component yet — journal is being
// reworked and we don't want to couple the two timelines.

function HabitsDateStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const haptic = useHaptic();
  const date = fromDateKey(value);
  const isToday = value === localDateKey();

  function shift(days: number) {
    haptic.selection();
    const d = fromDateKey(value);
    d.setDate(d.getDate() + days);
    onChange(localDateKey(d));
  }
  function jumpToday() {
    if (isToday) return;
    haptic.impact("light");
    onChange(localDateKey());
  }

  const shortFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const longFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <XStack
      items="center"
      justify="space-between"
      px="$2"
      py="$2"
      rounded="$3"
      bg="$color2"
      borderWidth={1}
      borderColor="$color6"
    >
      <DateChevron onPress={() => shift(-1)} glyph="‹" />
      <Pressable onPress={jumpToday} style={{ flex: 1, alignItems: "center" }}>
        <Paragraph
          fontFamily="$mono"
          fontSize={10}
          letterSpacing={1.6}
          textTransform="uppercase"
          color="$color11"
          fontWeight="600"
        >
          {isToday ? "Today · Tap to recenter" : shortFmt.format(date)}
        </Paragraph>
        <Text fontSize="$3" color="$color12" fontWeight="600">
          {longFmt.format(date)}
        </Text>
      </Pressable>
      <DateChevron onPress={() => shift(1)} glyph="›" />
    </XStack>
  );
}

function DateChevron({
  onPress,
  glyph,
}: {
  onPress: () => void;
  glyph: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View
        width={36}
        height={36}
        rounded="$2"
        items="center"
        justify="center"
        pressStyle={{ bg: "$color5" }}
      >
        <Text fontSize={22} color="$color11" fontWeight="600" lineHeight={22}>
          {glyph}
        </Text>
      </View>
    </Pressable>
  );
}
