import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, addDays, nextMonday } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, CalendarDays, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import {
  Button,
  Calendar,
  Hide,
  Input,
  Popover,
  Text,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useJournals } from "@/lib/api/journals";
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
  const { data: existingEntries } = useJournals({
    startDate: date,
    endDate: date,
  });

  const effectiveTitle = title.trim() || formatDefaultTitle(date);
  const dateInfo = getDateInfo(date);
  const currentMood = moods.find((m) => m.value === mood);

  // No URL rewrite on first save. TanStack Router intercepts
  // history.replaceState and re-matches the route, which remounts
  // new → $id and blurs the editor mid-typing (the bug this caused). The
  // autosave hook keeps the created id internally for subsequent PATCHes,
  // and the entry appears in the list immediately — so we just keep editing
  // in place. The URL stays /journal/new for this session.
  const { scheduleSave, status, journalId } = useAutosave({});

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
        <Hide above="md">
          <View mb="$5">
            <Button
              intent="ghost"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onPress={() => navigate({ to: "/journal" })}
            >
              Back
            </Button>
          </View>
        </Hide>

        {/* Title — `px={0}` strips the kit Input's internal horizontal inset
            that survives `unstyled`. Without it, the title text starts
            further inside than the pills row below, making the column edge
            look uneven. */}
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={formatDefaultTitle(date)}
          unstyled
          width="100%"
          marginBottom="$3"
          px={0}
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
              <Button intent="ghost" size="sm" gap="$1">
                {/* semantic date-status color (no kit token) — raw hex via style */}
                <Text lineHeight={0} style={{ color: dateInfo.color }}>
                  <CalendarDays size={12} />
                </Text>
                <Text fontSize="$1" style={{ color: dateInfo.color }}>
                  {dateInfo.label}
                </Text>
              </Button>
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
                      {...({
                        role: "button",
                        "aria-pressed": isActive,
                        "aria-label": shortcut.label,
                      } as object)}
                      cursor="pointer"
                      rounded={9999}
                      borderWidth={1}
                      px="$2.5"
                      py="$0.5"
                      transition="quick"
                      borderColor={isActive ? "$primary" : "$borderColor"}
                      bg={isActive ? "$primary" : undefined}
                      hoverStyle={isActive ? undefined : { bg: "$accent" }}
                      onPress={() => setDate(iso)}
                    >
                      <Text
                        fontSize="$1"
                        fontWeight="500"
                        color={
                          isActive ? "$primaryForeground" : "$mutedForeground"
                        }
                      >
                        {shortcut.label}
                      </Text>
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
              <Button intent="ghost" size="sm" gap="$1">
                {currentMood ? (
                  <XStack items="center" gap="$1">
                    <Text fontSize="$3">{currentMood.emoji}</Text>
                    <Text fontSize="$1" color="$mutedForeground">
                      {currentMood.label}
                    </Text>
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
                    <Text fontSize="$1" color="$mutedForeground">
                      Mood
                    </Text>
                  </XStack>
                )}
              </Button>
            </Popover.Trigger>
            <Popover.Content width="auto" p="$1">
              <ToggleGroup
                type="single"
                value={mood ? String(mood) : ""}
                onValueChange={(v: string) =>
                  setMood(v ? Number(v) : undefined)
                }
              >
                {moods.map((m) => (
                  <ToggleGroup.Item
                    key={m.value}
                    value={String(m.value)}
                    aria-label={m.label}
                  >
                    <Text fontSize="$5">{m.emoji}</Text>
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup>
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
            >
              <Text fontSize="$1" color="$accentForeground">
                {tag}
              </Text>
              <View
                {...({
                  role: "button",
                  "aria-label": `Remove ${tag}`,
                } as object)}
                cursor="pointer"
                onPress={() => setTags(tags.filter((t) => t !== tag))}
              >
                <Text
                  color="$accentForeground"
                  lineHeight={0}
                  hoverStyle={{ opacity: 0.6 }}
                >
                  <X size={12} />
                </Text>
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
