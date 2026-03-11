"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, addDays, nextMonday } from "date-fns";
import { ArrowLeft, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useJournals } from "@/lib/api/journals";
import { useWorkspace } from "@/lib/workspace-context";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { cn } from "@/lib/utils";

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

function formatDefaultTitle(isoDate: string): string {
  return format(parseISO(isoDate), "MMMM d, yyyy");
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
      label: format(parseISO(dateStr), "MMM d"),
      color: "text-red-600 dark:text-red-400",
    };
  return {
    label: format(parseISO(dateStr), "MMM d"),
    color: "text-blue-600 dark:text-blue-400",
  };
}

export default function NewJournalPage() {
  return (
    <Suspense>
      <NewJournalContent />
    </Suspense>
  );
}

function NewJournalContent() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  const routerRef = useRef(router);
  routerRef.current = router;
  const shortIdRef = useRef(workspace.shortId);
  shortIdRef.current = workspace.shortId;

  const onCreatedRef = useRef((id: string) => {
    routerRef.current.replace(`/${shortIdRef.current}/journal/${id}`);
  });

  const { scheduleSave, status, journalId } = useAutosave({
    onCreated: onCreatedRef.current,
  });

  const lastSavedRef = useRef({
    title: "",
    content: "",
    mood: undefined as number | undefined,
    tags: [] as string[],
    date: "",
  });

  // Autosave when user changes something
  useEffect(() => {
    if (
      !title.trim() &&
      !content.trim() &&
      mood === undefined &&
      tags.length === 0
    )
      return;
    const last = lastSavedRef.current;
    if (
      effectiveTitle === last.title &&
      content === last.content &&
      mood === last.mood &&
      JSON.stringify(tags) === JSON.stringify(last.tags) &&
      date === last.date
    )
      return;
    lastSavedRef.current = { title: effectiveTitle, content, mood, tags, date };
    scheduleSave({ title: effectiveTitle, content, mood, tags, date });
  }, [effectiveTitle, content, mood, tags, date, scheduleSave, title]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-4 pb-0">
        {!isDesktop && (
          <div className="mb-6">
            <button
              onClick={() => router.push(`/${workspace.shortId}/journal`)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          </div>
        )}

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={formatDefaultTitle(date)}
          className="mb-3 block w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />

        {/* Metadata pills row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Date pill */}
          <Popover>
            <PopoverTrigger asChild>
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
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
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
                selected={parseISO(date)}
                onSelect={(d) => {
                  if (d) setDate(format(d, "yyyy-MM-dd"));
                }}
                defaultMonth={parseISO(date)}
              />
            </PopoverContent>
          </Popover>

          {/* Mood pill */}
          <Popover>
            <PopoverTrigger asChild>
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
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1">
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
            </PopoverContent>
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
      </div>

      <JournalEditor
        content={content}
        onChange={setContent}
        placeholder="What's on your mind?"
        autoFocus
        date={date}
        excludeJournalId={journalId ?? undefined}
        saveStatus={status}
      />
    </div>
  );
}
