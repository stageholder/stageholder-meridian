import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, addDays, nextMonday } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import { Calendar, Input, Popover, YStack } from "@stageholder/ui";
import { useJournals } from "@/lib/api/journals";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { cn } from "@/lib/utils";
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

function getDateInfo(dateStr: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  if (dateStr === today)
    return { label: "Today", color: "text-green-600 dark:text-green-400" };
  if (dateStr === tomorrow)
    return { label: "Tomorrow", color: "text-amber-600 dark:text-amber-400" };
  if (dateStr < today)
    return {
      label: format(parseDateLocal(dateStr), "MMM d"),
      color: "text-red-600 dark:text-red-400",
    };
  return {
    label: format(parseDateLocal(dateStr), "MMM d"),
    color: "text-blue-600 dark:text-blue-400",
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
          <div className="mb-6">
            <button
              onClick={() => navigate({ to: "/journal" })}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          </div>
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Date pill */}
          <Popover placement="bottom-start">
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    dateInfo.color,
                  )}
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
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Content className="w-auto p-2">
              <div className="flex flex-wrap gap-1 pb-2">
                {[
                  { label: "Today", date: new Date() },
                  { label: "Tomorrow", date: addDays(new Date(), 1) },
                  { label: "Next Week", date: nextMonday(new Date()) },
                ].map((shortcut) => {
                  const iso = format(shortcut.date, "yyyy-MM-dd");
                  const isActive = date === iso;
                  return (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={() => setDate(iso)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
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
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {currentMood ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-sm">{currentMood.emoji}</span>
                    {currentMood.label}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 hover:border-foreground/30">
                    <span className="text-xs">🙂</span>
                    Mood
                  </span>
                )}
              </button>
            </Popover.Trigger>
            <Popover.Content className="w-auto p-1">
              <div className="flex items-center gap-1">
                {moods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() =>
                      setMood(mood === m.value ? undefined : m.value)
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors",
                      mood === m.value ? "bg-accent" : "hover:bg-accent",
                    )}
                    title={m.label}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover>

          {/* Tag pills */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {/* Add tag pill */}
          <TagInput tags={tags} onChange={setTags} inline />

          {/* Existing entries warning */}
          {existingEntries && existingEntries.length > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              · {existingEntries.length} existing{" "}
              {existingEntries.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
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
