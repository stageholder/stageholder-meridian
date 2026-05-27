import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { parseDateLocal } from "@/lib/date";
import { MoodDisplay } from "./mood-picker";
import type { Journal, JournalContent } from "@repo/core/types";

/**
 * Extract plain-text preview from journal content. Dispatches on the
 * Phase-2 dual-format shape:
 *   - string (legacy HTML) → strip tags
 *   - object (TipTap JSON) → walk the tree, concatenate text nodes
 *
 * Kept inline rather than reaching for the kit's RichTextRenderer
 * because we want plain text for the truncated preview, not formatted
 * inline HTML. (For full-document read-only render — e.g. printable
 * journal export — RichTextRenderer is the right choice.)
 */
function extractPlainPreview(content: JournalContent): string {
  if (typeof content === "string") return content.replace(/<[^>]*>/g, "");
  return collectText(content);
}

function collectText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text + " ";
  if (!Array.isArray(n.content)) return "";
  let out = "";
  for (const child of n.content) out += collectText(child);
  return out;
}

interface JournalListProps {
  journals: Journal[];
  isLoading: boolean;
  activeId?: string;
}

function getDateGroup(dateStr: string): string {
  const date = parseDateLocal(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "This Week";
  if (isThisYear(date)) return format(date, "MMMM");
  return format(date, "MMMM yyyy");
}

export function JournalList({
  journals,
  isLoading,
  activeId,
}: JournalListProps) {
  const grouped = useMemo(() => {
    const groups: { label: string; entries: Journal[] }[] = [];
    let currentLabel = "";

    for (const journal of journals) {
      const label = getDateGroup(journal.date);
      if (label !== currentLabel) {
        groups.push({ label, entries: [journal] });
        currentLabel = label;
      } else {
        groups[groups.length - 1]!.entries.push(journal);
      }
    }
    return groups;
  }, [journals]);

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading journal entries...
      </Text>
    );
  }

  if (journals.length === 0) {
    return (
      <View py="$8">
        <Text fontSize="$3" color="$mutedForeground" text="center">
          No journal entries yet. Write your first entry to get started.
        </Text>
      </View>
    );
  }

  return (
    <YStack gap="$4">
      {grouped.map((group) => (
        <View key={group.label}>
          <Text
            mb="$2"
            px="$1"
            fontSize="$1"
            fontWeight="600"
            color="$mutedForeground"
            letterSpacing={0.6}
            textTransform="uppercase"
          >
            {group.label}
          </Text>
          <YStack gap="$2">
            {group.entries.map((journal) => {
              const dateLabel = format(
                parseDateLocal(journal.date),
                "EEE, MMM d",
              );
              const isActive = journal.id === activeId;
              const plainText = extractPlainPreview(journal.content);
              const preview =
                plainText.length > 120
                  ? plainText.slice(0, 120) + "..."
                  : plainText;

              return (
                // Keep <Link> for routing (prefetch + middle-click); styling
                // moves to the inner YStack so the kit tokens/hover apply.
                <Link
                  key={journal.id}
                  to="/journal/$id"
                  params={{ id: journal.id }}
                  style={{ textDecoration: "none" }}
                >
                  <YStack
                    rounded="$lg"
                    borderWidth={1}
                    p="$3"
                    transition="quick"
                    borderColor={isActive ? "$primary" : "$borderColor"}
                    bg={isActive ? "$primaryMuted" : "$card"}
                    hoverStyle={isActive ? undefined : { bg: "$accent" }}
                  >
                    <XStack items="center" gap="$2">
                      <Text
                        flex={1}
                        minW={0}
                        fontSize="$3"
                        fontWeight="500"
                        color="$color"
                        numberOfLines={1}
                      >
                        {journal.title}
                      </Text>
                      <MoodDisplay mood={journal.mood} />
                    </XStack>
                    <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
                      {dateLabel}
                    </Text>
                    {preview ? (
                      <Text
                        mt="$1.5"
                        fontSize="$1"
                        color="$mutedForeground"
                        numberOfLines={2}
                      >
                        {preview}
                      </Text>
                    ) : null}
                    {Array.isArray(journal.tags) && journal.tags.length > 0 && (
                      <XStack mt="$1.5" flexWrap="wrap" gap="$1">
                        {(journal.tags as string[]).map((tag: string) => (
                          <Text
                            key={tag}
                            rounded={9999}
                            bg="$accent"
                            px="$1.5"
                            py="$0.5"
                            fontSize={10}
                            color="$accentForeground"
                          >
                            {tag}
                          </Text>
                        ))}
                      </XStack>
                    )}
                  </YStack>
                </Link>
              );
            })}
          </YStack>
        </View>
      ))}
    </YStack>
  );
}
