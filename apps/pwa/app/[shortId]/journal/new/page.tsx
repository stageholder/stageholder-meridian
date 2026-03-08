"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { MoodPicker } from "@/components/journal/mood-picker";
import { TagInput } from "@/components/journal/tag-input";
import { DatePicker } from "@/components/ui/date-picker";
import { useCreateJournal, useJournals } from "@/lib/api/journals";
import { useWorkspace } from "@/lib/workspace-context";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { toast } from "sonner";

function formatDefaultTitle(isoDate: string): string {
  return format(parseISO(isoDate), "MMMM d, yyyy");
}

export default function NewJournalPage() {
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
  const createJournal = useCreateJournal();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { data: existingEntries } = useJournals({ startDate: date, endDate: date });

  const effectiveTitle = title.trim() || formatDefaultTitle(date);

  // Unsaved changes warning
  const hasContent = !!(title.trim() || content.trim() || mood !== undefined || tags.length > 0);

  useEffect(() => {
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasContent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createJournal.mutate(
      {
        title: effectiveTitle,
        content,
        mood,
        tags,
        date,
      },
      {
        onSuccess: (newJournal) => {
          toast.success("Journal entry created");
          router.push(`/${workspace.shortId}/journal/${newJournal.id}`);
        },
        onError: () => {
          toast.error("Failed to create journal entry");
        },
      }
    );
  }

  return (
    <div className="space-y-6 p-4">
      {!isDesktop && (
        <button
          onClick={() => router.push(`/${workspace.shortId}/journal`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      <h1 className="text-2xl font-bold text-foreground">New Journal Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="journal-title" className="block text-sm font-medium text-foreground">
            Title <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="journal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={formatDefaultTitle(date)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Date
            </label>
            <div className="mt-1">
              <DatePicker
                value={date}
                onChange={setDate}
                clearable={false}
              />
              {existingEntries && existingEntries.length > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  You already have {existingEntries.length}{" "}
                  {existingEntries.length === 1 ? "entry" : "entries"} for this date
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Mood
            </label>
            <div className="mt-1">
              <MoodPicker value={mood} onChange={setMood} />
            </div>
          </div>
        </div>

        <TagInput tags={tags} onChange={setTags} />

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Content</label>
          <JournalEditor
            content={content}
            onChange={setContent}
            placeholder="What's on your mind?"
            autoFocus
            date={date}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createJournal.isPending}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createJournal.isPending ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
