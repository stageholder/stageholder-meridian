"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useJournal, useDeleteJournal } from "@/lib/api/journals";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

export default function JournalEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: journal, isLoading } = useJournal(params.id);
  const deleteJournal = useDeleteJournal();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const lastSavedRef = useRef({
    title: "",
    content: "",
    mood: undefined as number | undefined,
    tags: [] as string[],
  });
  const journalDateRef = useRef("");

  const { scheduleSave, status } = useAutosave({ journalId: params.id });

  const currentMood = moods.find((m) => m.value === mood);

  // Initialize form state from fetched journal (once)
  useEffect(() => {
    if (journal && !initialized) {
      setTitle(journal.title);
      setContent(journal.content);
      setMood(journal.mood);
      setTags(Array.isArray(journal.tags) ? journal.tags : []);
      lastSavedRef.current = {
        title: journal.title,
        content: journal.content,
        mood: journal.mood,
        tags: Array.isArray(journal.tags) ? journal.tags : [],
      };
      journalDateRef.current = journal.date;
      setInitialized(true);
    }
  }, [journal, initialized]);

  // Autosave when user changes something — compare against last saved, not fetched journal
  useEffect(() => {
    if (!initialized) return;
    const last = lastSavedRef.current;
    if (
      title === last.title &&
      content === last.content &&
      mood === last.mood &&
      JSON.stringify(tags) === JSON.stringify(last.tags)
    )
      return;
    const saveData = {
      title: title.trim() || last.title,
      content,
      mood,
      tags,
      date: journalDateRef.current,
    };
    lastSavedRef.current = { title: saveData.title, content, mood, tags };
    scheduleSave(saveData);
  }, [initialized, title, content, mood, tags, scheduleSave]);

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;

    deleteJournal.mutate(params.id, {
      onSuccess: () => {
        toast.success("Journal entry deleted");
        router.push("/app/journal");
      },
      onError: () => {
        toast.error("Failed to delete journal entry");
      },
    });
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!journal) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Journal entry not found.
        </p>
      </div>
    );
  }

  const dateLabel = format(parseDateLocal(journal.date), "MMM d, yyyy");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 overflow-hidden p-4 pb-0">
        {!isDesktop && (
          <div className="mb-6">
            <button
              onClick={() => router.push("/app/journal")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          </div>
        )}

        {/* Title + delete */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="block min-w-0 flex-1 bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={handleDelete}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete entry"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/* Metadata pills row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Date pill (read-only for existing entries) */}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
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
            {dateLabel}
          </span>

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
                    <span className="text-xs">{"\u{1F642}"}</span>
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
        </div>
      </div>

      {initialized && (
        <JournalEditor
          content={content}
          onChange={setContent}
          date={journal.date}
          excludeJournalId={params.id}
          saveStatus={status}
        />
      )}
    </div>
  );
}
