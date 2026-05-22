import { Link } from "@tanstack/react-router";
import { Text, XStack, YStack } from "@stageholder/ui";
import { useJournals } from "@/lib/api/journals";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { MoodDisplay } from "@/components/journal/mood-picker";
import { parseDateLocal } from "@/lib/date";
import { BentoCard } from "./bento-card";
import type { Journal } from "@repo/core/types";

export function RecentJournals({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  const { isSetup, isUnlocked } = useEncryptionStore();
  const isLocked = isSetup && !isUnlocked;
  const { data: journals, isLoading } = useJournals(undefined, {
    enabled: !isLocked,
  });
  const recentJournals = (journals || []).slice(0, 5);

  return (
    <BentoCard
      title="Recent Journal Entries"
      href="/journal"
      index={index}
      className={className}
      action={
        <Link to="/journal" style={{ textDecoration: "none" }}>
          <Text
            fontSize="$1"
            color="$primary"
            hoverStyle={{ textDecorationLine: "underline" }}
          >
            View all
          </Text>
        </Link>
      }
    >
      {isLocked ? (
        <Text fontSize="$1" color="$mutedForeground">
          Unlock your journal to see recent entries.
        </Text>
      ) : isLoading ? (
        <Text fontSize="$1" color="$mutedForeground">
          Loading...
        </Text>
      ) : recentJournals.length > 0 ? (
        // Horizontal snap-scroller. scroll-snap (snap-x/snap-start) + x-only
        // overflow have no Tamagui token — kept via className/style hatch;
        // layout/spacing moved to props.
        <XStack
          gap="$3"
          pb="$1"
          className="snap-x"
          style={{ overflowX: "auto" }}
        >
          {recentJournals.map((journal: Journal) => {
            const dateStr = parseDateLocal(journal.date).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
              },
            );

            return (
              <Link
                key={journal.id}
                to="/journal/$id"
                params={{ id: journal.id }}
                style={{ textDecoration: "none" }}
                className="snap-start"
              >
                <YStack
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
                  {journal.wordCount > 0 && (
                    <Text fontSize={10} color="$mutedForeground">
                      {journal.wordCount} words
                    </Text>
                  )}
                </YStack>
              </Link>
            );
          })}
        </XStack>
      ) : (
        <Text fontSize="$1" color="$mutedForeground">
          No journal entries yet.
        </Text>
      )}
    </BentoCard>
  );
}
