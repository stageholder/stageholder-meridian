import { useMemo } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import { Text, View, XStack, YStack, usePressScale } from "@stageholder/ui";
import type { Journal, JournalContent } from "@repo/core/types";
import { MoodDisplay } from "./mood-display";

/** Parse a `yyyy-MM-dd` or full ISO date string as the LOCAL day. */
function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

/**
 * Extract plain-text preview from journal content. Dispatches on the
 * Phase-2 dual-format shape:
 *   - string (legacy HTML) → strip tags
 *   - object (TipTap JSON)  → walk the tree, concatenate text nodes
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

function getDateGroup(dateStr: string): string {
  const date = parseDateLocal(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "This Week";
  if (isThisYear(date)) return format(date, "MMMM");
  return format(date, "MMMM yyyy");
}

export interface JournalListProps {
  journals: Journal[];
  isLoading?: boolean;
  /** Highlights the entry that's currently open in the detail pane. */
  activeId?: string;
  /**
   * Called when the user taps a journal entry. The host's wrapper wires
   * this to navigation (e.g. PWA: `useNavigate` to `/journal/$id`; mobile:
   * Expo Router's `router.push`).
   */
  onJournalPress?: (id: string) => void;
}

/**
 * Date-grouped journal list (Today / Yesterday / This Week / Month).
 * Each entry shows the title + a short plain-text preview, mood emoji,
 * and optional tag pills. Pure presentational — host supplies journals
 * + the `onJournalPress` nav callback.
 *
 * The previous `<Link to="/journal/$id">` is replaced with an `onPress`
 * handler on the row container so the same view runs on both web and
 * RN. PWA wrappers wire `useNavigate`; the trade-off is losing
 * middle-click-to-new-tab on web.
 */
export function JournalList({
  journals,
  isLoading,
  activeId,
  onJournalPress,
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
            {group.entries.map((journal) => (
              <JournalListItem
                key={journal.id}
                journal={journal}
                isActive={journal.id === activeId}
                onPress={
                  onJournalPress ? () => onJournalPress(journal.id) : undefined
                }
              />
            ))}
          </YStack>
        </View>
      ))}
    </YStack>
  );
}

interface JournalListItemProps {
  journal: Journal;
  isActive: boolean;
  /** Bound nav callback, or undefined when the list isn't interactive. */
  onPress?: () => void;
}

/**
 * One journal row — split out of the list `.map` so each row can own a
 * `usePressScale` hook (hooks can't run inside a loop). The kit hook latches
 * the pressed flag ~220ms past release, so a *quick* nav tap still paints the
 * full scale animation that a CSS `pressStyle` (`:active`) drops the instant
 * the pointer lifts. `transition="quick"` supplies the easing; `haptic: "none"`
 * follows the kit's list-row guidance (no buzz on every row tap).
 */
function JournalListItem({ journal, isActive, onPress }: JournalListItemProps) {
  const dateLabel = format(parseDateLocal(journal.date), "EEE, MMM d");
  const plainText = extractPlainPreview(journal.content);
  const preview =
    plainText.length > 120 ? plainText.slice(0, 120) + "..." : plainText;
  const { handlers, pressProps } = usePressScale({
    onPress,
    disabled: !onPress,
    haptic: "none",
  });

  return (
    <YStack
      {...handlers}
      {...pressProps}
      cursor={onPress ? "pointer" : undefined}
      rounded="$lg"
      borderWidth={1}
      p="$3"
      transition="quick"
      borderColor={isActive ? "$primary" : "$borderColor"}
      bg={isActive ? "$primaryMuted" : "$card"}
      hoverStyle={isActive ? undefined : { bg: "$accent" }}
      role={onPress ? "button" : undefined}
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
      {Array.isArray(journal.tags) && journal.tags.length > 0 ? (
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
      ) : null}
    </YStack>
  );
}
