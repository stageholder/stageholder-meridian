import { useMemo } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import {
  Badge,
  MOOD_DEFAULT_OPTIONS,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
  usePressScale,
} from "@stageholder/ui";
import { BookOpen } from "@tamagui/lucide-icons-2";
import type { Journal, JournalContent } from "@repo/core/types";

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

// Mood → accent hue for the card's edge stripe (the kit mood scale carries
// no colors). Literal hexes per the kit's strict color typing — a quiet,
// desaturated ramp so a page of entries reads as a mood timeline without
// shouting. No mood → no stripe (transparent edge keeps the geometry).
const MOOD_ACCENT = {
  1: "#f87171", // terrible — red
  2: "#fbbf24", // low — amber
  3: "#a8a29e", // okay — stone
  4: "#4ade80", // good — green
  5: "#2dd4bf", // great — teal
} as const;

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
 * Date-grouped journal timeline (Today / Yesterday / This Week / Month).
 *
 * Visual structure, level by level:
 *   - GROUP — uppercase label · hairline rule flexing to the edge · entry
 *     count. Reads as a ruled ledger line, not a floating caption.
 *   - CARD  — journal-app (Day One) anatomy: a fixed date rail (weekday +
 *     big day-of-month + mood emoji) beside the content column (title,
 *     two-line preview, words + tags meta). A 3px mood-tinted stripe on
 *     the leading edge turns a scroll of entries into a mood timeline.
 *   - MOTION — cards rise in on mount (`enterStyle` + `transition`, the
 *     cross-platform Tamagui pair: CSS on web, Reanimated on native) and
 *     scale on press via the kit's `usePressScale` latch.
 *   - LOADING — skeleton cards in the real card geometry (no layout jump
 *     when data lands). EMPTY — quiet illustrated prompt.
 *
 * Pure presentational — host supplies journals + the nav callback.
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
      <YStack gap="$2">
        {[0, 1, 2].map((i) => (
          <XStack
            key={i}
            rounded="$6"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            p="$3"
            gap="$3"
            items="center"
          >
            <Skeleton width={48} height={56} rounded="$4" />
            <YStack flex={1} minW={0} gap="$2">
              <Skeleton width="55%" height={14} rounded="$2" />
              <Skeleton width="92%" height={10} rounded="$2" />
              <Skeleton width="38%" height={10} rounded="$2" />
            </YStack>
          </XStack>
        ))}
      </YStack>
    );
  }

  if (journals.length === 0) {
    return (
      <YStack py="$8" px="$4" items="center" gap="$2">
        <View
          width={56}
          height={56}
          rounded={9999}
          bg="$accent"
          items="center"
          justify="center"
          mb="$1"
        >
          <BookOpen size={24} color="$mutedForeground" />
        </View>
        <Text fontSize="$4" fontWeight="600" color="$color">
          No entries yet
        </Text>
        <Text fontSize="$2" color="$mutedForeground" text="center" maxW={260}>
          A few lines a day is enough — your story builds itself.
        </Text>
      </YStack>
    );
  }

  return (
    <YStack gap="$5">
      {grouped.map((group) => (
        <View
          key={group.label}
          // Whole group fades in; the cards inside add their own rise.
          enterStyle={{ opacity: 0 }}
          transition="quick"
        >
          <XStack items="center" gap="$2.5" mb="$2.5" px="$1">
            <Text
              fontSize="$1"
              fontWeight="700"
              color="$mutedForeground"
              letterSpacing={1.1}
              textTransform="uppercase"
            >
              {group.label}
            </Text>
            <View flex={1} height={1} bg="$borderColor" opacity={0.55} />
            <Text fontSize="$1" color="$mutedForeground" opacity={0.8}>
              {group.entries.length}
            </Text>
          </XStack>
          <YStack gap="$2.5">
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

/** How many tag pills a card shows before collapsing into "+N". */
const MAX_TAGS = 3;

/**
 * One journal card. Split out of the list `.map` so each row can own a
 * `usePressScale` hook (hooks can't run inside a loop). The kit hook latches
 * the pressed flag ~220ms past release, so a *quick* nav tap still paints the
 * full scale animation; `transition="quick"` supplies the easing and also
 * drives the `enterStyle` rise-in on mount. `haptic: "none"` follows the
 * kit's list-row guidance (no buzz on every row tap).
 */
function JournalListItem({ journal, isActive, onPress }: JournalListItemProps) {
  const date = parseDateLocal(journal.date);
  const plainText = extractPlainPreview(journal.content).trim();
  const preview =
    plainText.length > 140 ? plainText.slice(0, 140) + "…" : plainText;
  const mood = MOOD_DEFAULT_OPTIONS.find((m) => m.value === journal.mood);
  const accent =
    MOOD_ACCENT[journal.mood as keyof typeof MOOD_ACCENT] ?? "transparent";
  const tags = Array.isArray(journal.tags) ? (journal.tags as string[]) : [];
  const shownTags = tags.slice(0, MAX_TAGS);
  const hasMeta = journal.wordCount > 0 || tags.length > 0;

  const { handlers, pressProps } = usePressScale({
    onPress,
    disabled: !onPress,
    haptic: "none",
  });

  return (
    <XStack
      {...handlers}
      {...pressProps}
      cursor={onPress ? "pointer" : undefined}
      role={onPress ? "button" : undefined}
      rounded="$6"
      borderWidth={1}
      overflow="hidden"
      transition="quick"
      enterStyle={{ opacity: 0, y: 14 }}
      borderColor={isActive ? "$primary" : "$borderColor"}
      bg={isActive ? "$primaryMuted" : "$card"}
      hoverStyle={isActive ? undefined : { bg: "$accent" }}
      // Paper lift — soft, theme-agnostic; the border still carries the
      // edge in dark mode where the shadow disappears.
      boxShadow="0 1px 3px rgba(0,0,0,0.07)"
    >
      {/* Mood stripe — the card's leading edge. Transparent (geometry
          preserved) when the entry has no mood. */}
      <View width={3} flexBasis="auto" shrink={0} self="stretch" bg={accent} />

      {/* Date rail — weekday over a big day-of-month, mood emoji beneath.
          Fixed width: explicit flexBasis/shrink so the Tamagui flex
          shorthand can't collapse it (flexBasis:0% gotcha). */}
      <YStack
        width={54}
        flexBasis="auto"
        shrink={0}
        items="center"
        justify="center"
        py="$3"
        gap="$0.5"
      >
        <Text
          fontSize={10}
          fontWeight="700"
          color="$mutedForeground"
          letterSpacing={1.4}
          textTransform="uppercase"
        >
          {format(date, "EEE")}
        </Text>
        <Text fontSize="$7" fontWeight="700" color="$color" lineHeight={30}>
          {format(date, "d")}
        </Text>
        {mood ? <Text fontSize="$3">{mood.emoji}</Text> : null}
      </YStack>

      <View
        width={1}
        flexBasis="auto"
        shrink={0}
        self="stretch"
        bg="$borderColor"
        opacity={0.5}
      />

      {/* Content column. */}
      <YStack flex={1} minW={0} px="$3" py="$3" gap="$1">
        <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
          {journal.title}
        </Text>
        {preview ? (
          <Text
            fontSize="$2"
            color="$mutedForeground"
            lineHeight={18}
            numberOfLines={2}
          >
            {preview}
          </Text>
        ) : null}
        {hasMeta ? (
          <XStack items="center" flexWrap="wrap" gap="$1.5" mt="$1">
            {journal.wordCount > 0 ? (
              <Text fontSize="$1" color="$mutedForeground" opacity={0.85}>
                {journal.wordCount} {journal.wordCount === 1 ? "word" : "words"}
              </Text>
            ) : null}
            {shownTags.map((tag) => (
              <Badge key={tag} intent="neutral" variant="soft" size="$2">
                <Badge.Label>{tag}</Badge.Label>
              </Badge>
            ))}
            {tags.length > MAX_TAGS ? (
              <Text fontSize="$1" color="$mutedForeground">
                +{tags.length - MAX_TAGS}
              </Text>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
}
