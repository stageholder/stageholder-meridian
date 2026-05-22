import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, addDays, nextMonday } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import {
  Calendar,
  Input,
  Popover,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useJournals } from "@/lib/api/journals";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAutosave } from "@/lib/hooks/use-autosave";
import type { JournalContent } from "@repo/core/types";
import { countWordsFromContent } from "@repo/core/utils/text";

type NewJournalSearch = {
  date?: string;
};

export const Route = createFileRoute("/_app/journal/new")({
  validateSearch: (search: Record<string, unknown>): NewJournalSearch => ({
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: NewJournalPage,
});

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

function formatDefaultTitle(isoDate: string): string {
  return format(parseDateLocal(isoDate), "MMMM d, yyyy");
}

// Semantic date-status colors (today=green, tomorrow=amber, past=red,
// future=blue). No kit token equivalent — fixed 500-level hexes that read
// in both light and dark.
function getDateInfo(dateStr: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  if (dateStr === today) return { label: "Today", color: "#16a34a" };
  if (dateStr === tomorrow) return { label: "Tomorrow", color: "#d97706" };
  if (dateStr < today)
    return {
      label: format(parseDateLocal(dateStr), "MMM d"),
      color: "#dc2626",
    };
  return {
    label: format(parseDateLocal(dateStr), "MMM d"),
    color: "#2563eb",
  };
}

function NewJournalPage() {
  const navigate = useNavigate();
  const { date: dateParam } = Route.useSearch();
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  // New journals always start as JSON content — there's no legacy HTML
  // for a fresh entry. Type matches the editor's onChange signature.
  const [content, setContent] = useState<JournalContent>("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState(dateParam || today);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { data: existingEntries } = useJournals({
    startDate: date,
    endDate: date,
  });

  const effectiveTitle = title.trim() || formatDefaultTitle(date);
  const dateInfo = getDateInfo(date);
  const currentMood = moods.find((m) => m.value === mood);

  const onCreatedRef = useRef((id: string) => {
    // Update URL silently without unmounting/remounting the page so the
    // editor keeps focus and doesn't blink during the first autosave.
    window.history.replaceState(null, "", `/journal/${id}`);
  });

  const { scheduleSave, status, journalId } = useAutosave({
    onCreated: onCreatedRef.current,
  });

  const lastSavedRef = useRef<{
    title: string;
    content: JournalContent;
    mood: number | undefined;
    tags: string[];
    date: string;
  }>({
    title: "",
    content: "",
    mood: undefined,
    tags: [] as string[],
    date: "",
  });

  // Autosave when user changes something. Content is dual-format during
  // the Phase 2 window — string (legacy HTML) or object (TipTap JSON) —
  // so the "is this entry empty?" check goes through
  // `countWordsFromContent` (returns 0 for both `""` and the empty
  // TipTap doc `{type:"doc",content:[{type:"paragraph"}]}`), and the
  // "has the content changed?" check uses JSON.stringify for shape-
  // agnostic equality (primitive `===` never matches between two JSON
  // object instances, even when their content is identical).
  useEffect(() => {
    if (
      !title.trim() &&
      countWordsFromContent(content) === 0 &&
      mood === undefined &&
      tags.length === 0
    )
      return;
    const last = lastSavedRef.current;
    if (
      effectiveTitle === last.title &&
      JSON.stringify(content) === JSON.stringify(last.content) &&
      mood === last.mood &&
      JSON.stringify(tags) === JSON.stringify(last.tags) &&
      date === last.date
    )
      return;
    lastSavedRef.current = { title: effectiveTitle, content, mood, tags, date };
    scheduleSave({ title: effectiveTitle, content, mood, tags, date });
  }, [effectiveTitle, content, mood, tags, date, scheduleSave, title]);

  return (
    // 3-pane editor pane: fills the available column with Tamagui-token
    // padding for breathing room. No artificial max-width — that's a
    // single-pane editor pattern (iA Writer / Substack standalone) and
    // doesn't fit our 3-pane workspace layout. See $id.tsx for the
    // full design reasoning.
    <YStack flex={1} height="100%">
      <YStack shrink={0} px="$4" pt="$4">
        {!isDesktop && (
          <View mb="$5">
            <XStack
              tag="button"
              items="center"
              gap="$1"
              fontSize="$3"
              color="$mutedForeground"
              hoverStyle={{ color: "$color" }}
              onPress={() => navigate({ to: "/journal" })}
            >
              <ArrowLeft size={16} />
              Back
            </XStack>
          </View>
        )}

        {/* Title — `paddingHorizontal={0}` strips the kit Input's internal
            horizontal inset that survives `unstyled`. Without it, the
            title text starts further inside than the pills row below,
            making the column edge look uneven. */}
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={formatDefaultTitle(date)}
          unstyled
          width="100%"
          marginBottom="$3"
          paddingHorizontal={0}
          bg="transparent"
          fontSize={24}
          fontWeight="700"
          color="$color"
          placeholderTextColor="$mutedForeground"
          focusVisibleStyle={{ outlineWidth: 0 }}
        />

        {/* Metadata pills row */}
        <XStack mb="$4" flexWrap="wrap" items="center" gap="$2">
          {/* Date pill */}
          <Popover placement="bottom-start">
            <Popover.Trigger asChild>
              <XStack
                tag="button"
                items="center"
                gap="$1"
                fontSize="$1"
                transition="quick"
                // semantic date-status color (no kit token); icon inherits via currentColor
                color={dateInfo.color}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                {dateInfo.label}
              </XStack>
            </Popover.Trigger>
            <Popover.Content width="auto" p="$2">
              <XStack flexWrap="wrap" gap="$1" pb="$2">
                {[
                  { label: "Today", date: new Date() },
                  { label: "Tomorrow", date: addDays(new Date(), 1) },
                  { label: "Next Week", date: nextMonday(new Date()) },
                ].map((shortcut) => {
                  const iso = format(shortcut.date, "yyyy-MM-dd");
                  const isActive = date === iso;
                  return (
                    <XStack
                      key={shortcut.label}
                      tag="button"
                      rounded={9999}
                      borderWidth={1}
                      px="$2.5"
                      py="$0.5"
                      fontSize="$1"
                      fontWeight="500"
                      transition="quick"
                      borderColor={isActive ? "$primary" : "$borderColor"}
                      bg={isActive ? "$primary" : undefined}
                      color={
                        isActive ? "$primaryForeground" : "$mutedForeground"
                      }
                      hoverStyle={
                        isActive
                          ? undefined
                          : { bg: "$accent", color: "$color" }
                      }
                      onPress={() => setDate(iso)}
                    >
                      {shortcut.label}
                    </XStack>
                  );
                })}
              </XStack>
              <Calendar
                mode="single"
                value={parseDateLocal(date)}
                onChange={(d) => {
                  if (d) setDate(format(d, "yyyy-MM-dd"));
                }}
                initialMonth={parseDateLocal(date)}
              />
            </Popover.Content>
          </Popover>

          {/* Mood pill */}
          <Popover placement="bottom-start">
            <Popover.Trigger asChild>
              <XStack
                tag="button"
                items="center"
                gap="$1"
                fontSize="$1"
                color="$mutedForeground"
                transition="quick"
                hoverStyle={{ color: "$color" }}
              >
                {currentMood ? (
                  <XStack items="center" gap="$1">
                    <Text fontSize="$3">{currentMood.emoji}</Text>
                    {currentMood.label}
                  </XStack>
                ) : (
                  <XStack
                    items="center"
                    gap="$1"
                    rounded={9999}
                    borderWidth={1}
                    borderStyle="dashed"
                    borderColor="$borderColor"
                    px="$2"
                    py="$0.5"
                  >
                    <Text fontSize="$1">🙂</Text>
                    Mood
                  </XStack>
                )}
              </XStack>
            </Popover.Trigger>
            <Popover.Content width="auto" p="$1">
              <XStack items="center" gap="$1">
                {moods.map((m) => (
                  <XStack
                    key={m.value}
                    tag="button"
                    items="center"
                    justify="center"
                    height={36}
                    width={36}
                    rounded="$lg"
                    fontSize="$6"
                    transition="quick"
                    bg={mood === m.value ? "$accent" : undefined}
                    hoverStyle={{ bg: "$accent" }}
                    title={m.label}
                    onPress={() =>
                      setMood(mood === m.value ? undefined : m.value)
                    }
                  >
                    {m.emoji}
                  </XStack>
                ))}
              </XStack>
            </Popover.Content>
          </Popover>

          {/* Tag pills */}
          {tags.map((tag) => (
            <XStack
              key={tag}
              items="center"
              gap="$1"
              rounded={9999}
              bg="$accent"
              px="$2"
              py="$0.5"
              fontSize="$1"
              color="$accentForeground"
            >
              {tag}
              <View
                tag="button"
                color="$mutedForeground"
                hoverStyle={{ color: "$color" }}
                onPress={() => setTags(tags.filter((t) => t !== tag))}
              >
                <X size={12} />
              </View>
            </XStack>
          ))}

          {/* Add tag pill */}
          <TagInput tags={tags} onChange={setTags} inline />

          {/* Existing entries warning */}
          {existingEntries && existingEntries.length > 0 && (
            // semantic amber warning text (no kit token) — fixed hex for both modes
            <Text fontSize="$1" color="#d97706">
              · {existingEntries.length} existing{" "}
              {existingEntries.length === 1 ? "entry" : "entries"}
            </Text>
          )}
        </XStack>
      </YStack>

      <JournalEditor
        content={content}
        onChange={setContent}
        placeholder="What's on your mind?"
        autoFocus
        date={date}
        excludeJournalId={journalId ?? undefined}
        saveStatus={status}
      />
    </YStack>
  );
}
