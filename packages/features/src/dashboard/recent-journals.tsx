import { isWeb } from "tamagui";
import { ScrollView, Text, XStack, YStack } from "@stageholder/ui";
import type { Journal } from "@repo/core/types";
import { MoodDisplay } from "../journal/mood-display";

// CSS scroll-snap for the horizontal card strip (was Tailwind `snap-x` /
// `snap-start`). Web-only CSS keys — guarded with `isWeb` so they never
// reach RN's style validator; native falls back to plain smooth scrolling.
const snapContainer = isWeb
  ? ({ scrollSnapType: "x proximity" } as object)
  : undefined;
const snapItem = isWeb ? ({ scrollSnapAlign: "start" } as object) : undefined;

/** Parse a `yyyy-MM-dd` or full ISO date string as the LOCAL day. */
function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

export interface RecentJournalsProps {
  journals: Journal[];
  isLoading?: boolean;
  /**
   * True when journal encryption is set up but not unlocked — the view
   * shows a "unlock to see" hint instead of the list.
   */
  isLocked?: boolean;
  /** Open a single journal entry. */
  onJournalPress?: (id: string) => void;
}

/**
 * CONTENT-ONLY dashboard cell body: the 5 most recent journal entries as a
 * horizontal snap-scroll of compact cards (mood + date + title + word count).
 * Card chrome (title, "View all", grid position) is owned by the host's kit
 * `Dashboard.Widget`. The host fetches; the view picks the first 5.
 */
export function RecentJournals({
  journals,
  isLoading,
  isLocked,
  onJournalPress,
}: RecentJournalsProps) {
  const recentJournals = journals.slice(0, 5);

  return (
    <YStack>
      {isLocked ? (
        <Text fontSize="$1" color="$mutedForeground">
          Unlock your journal to see recent entries.
        </Text>
      ) : isLoading ? (
        <Text fontSize="$1" color="$mutedForeground">
          Loading...
        </Text>
      ) : recentJournals.length > 0 ? (
        // Horizontal scroller via the kit ScrollView (a real RN ScrollView on
        // native, a slim-scrollbar div on web) — cross-platform. Scroll-snap
        // has no kit token, so it's an isWeb-guarded inline style on the
        // ScrollView + cards (undefined on native, where smooth scroll is the
        // fallback). The inner XStack carries the gap between cards.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={snapContainer}
        >
          <XStack gap="$3" pb="$1">
            {recentJournals.map((journal) => {
              const dateStr = parseDateLocal(journal.date).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                },
              );

              return (
                <YStack
                  key={journal.id}
                  onPress={() => onJournalPress?.(journal.id)}
                  cursor={onJournalPress ? "pointer" : undefined}
                  style={snapItem}
                  minW={160}
                  shrink={0}
                  gap="$1.5"
                  rounded="$lg"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$muted"
                  p="$3"
                  transition="quick"
                  hoverStyle={{ bg: "$accent" }}
                  role={onJournalPress ? "button" : undefined}
                >
                  <XStack items="center" gap="$1.5">
                    <MoodDisplay mood={journal.mood} />
                    <Text fontSize="$1" color="$mutedForeground">
                      {dateStr}
                    </Text>
                  </XStack>
                  <Text
                    numberOfLines={2}
                    fontSize="$3"
                    fontWeight="500"
                    color="$color"
                  >
                    {journal.title}
                  </Text>
                  {journal.wordCount > 0 ? (
                    <Text fontSize={10} color="$mutedForeground">
                      {journal.wordCount} words
                    </Text>
                  ) : null}
                </YStack>
              );
            })}
          </XStack>
        </ScrollView>
      ) : (
        <Text fontSize="$1" color="$mutedForeground">
          No journal entries yet.
        </Text>
      )}
    </YStack>
  );
}
