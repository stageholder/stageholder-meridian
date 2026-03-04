"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JournalEditor } from "@/components/journal/journal-editor";
import { MoodPicker } from "@/components/journal/mood-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { useCreateJournal } from "@/lib/api/journals";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

export default function NewJournalPage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const createJournal = useCreateJournal();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    createJournal.mutate(
      {
        title: title.trim(),
        content,
        mood,
        date,
      },
      {
        onSuccess: () => {
          toast.success("Journal entry created");
          router.push(`/${workspace.shortId}/journal`);
        },
        onError: () => {
          toast.error("Failed to create journal entry");
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">New Journal Entry</h1>
        <button
          onClick={() => router.push(`/${workspace.shortId}/journal`)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="journal-title" className="block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="journal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your entry a title"
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
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

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Content</label>
          <JournalEditor
            content={content}
            onChange={setContent}
            placeholder="What's on your mind?"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!title.trim() || createJournal.isPending}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createJournal.isPending ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
