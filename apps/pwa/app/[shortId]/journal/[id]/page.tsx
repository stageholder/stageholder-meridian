"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { MoodPicker } from "@/components/journal/mood-picker";
import { TagInput } from "@/components/journal/tag-input";
import { useJournal, useUpdateJournal, useDeleteJournal } from "@/lib/api/journals";
import { useWorkspace } from "@/lib/workspace-context";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";

export default function JournalEntryPage() {
  const { workspace } = useWorkspace();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: journal, isLoading } = useJournal(params.id);
  const updateJournal = useUpdateJournal();
  const deleteJournal = useDeleteJournal();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (journal) {
      setTitle(journal.title);
      setContent(journal.content);
      setMood(journal.mood);
      setTags(journal.tags);
    }
  }, [journal]);

  // Unsaved changes warning when editing
  const isDirty =
    isEditing &&
    journal != null &&
    (title !== journal.title ||
      content !== journal.content ||
      mood !== journal.mood ||
      JSON.stringify(tags) !== JSON.stringify(journal.tags));

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    updateJournal.mutate(
      {
        id: params.id,
        data: {
          title: title.trim(),
          content,
          mood,
          tags,
        },
      },
      {
        onSuccess: () => {
          toast.success("Journal entry updated");
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Failed to update journal entry");
        },
      }
    );
  }

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;

    deleteJournal.mutate(params.id, {
      onSuccess: () => {
        toast.success("Journal entry deleted");
        router.push(`/${workspace.shortId}/journal`);
      },
      onError: () => {
        toast.error("Failed to delete journal entry");
      },
    });
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!journal) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Journal entry not found.</p>
      </div>
    );
  }

  const dateStr = new Date(journal.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Content is sanitized via sanitizeHtml before rendering
  const sanitizedContent = sanitizeHtml(journal.content);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        {!isDesktop && (
          <button
            onClick={() => router.push(`/${workspace.shortId}/journal`)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        )}
        <div className={`flex items-center gap-2 ${isDesktop ? "" : "ml-auto"}`}>
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setTitle(journal.title);
                  setContent(journal.content);
                  setMood(journal.mood);
                  setTags(journal.tags);
                  setIsEditing(false);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateJournal.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateJournal.isPending ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Mood</label>
            <div className="mt-1">
              <MoodPicker value={mood} onChange={setMood} />
            </div>
          </div>
          <TagInput tags={tags} onChange={setTags} />
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Content</label>
            <JournalEditor
              content={content}
              onChange={setContent}
              date={journal.date}
              excludeJournalId={params.id}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{journal.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{dateStr}</span>
              {journal.mood && (
                <span className="text-lg">
                  {journal.mood === 1 ? "\u{1F622}" : journal.mood === 2 ? "\u{1F641}" : journal.mood === 3 ? "\u{1F610}" : journal.mood === 4 ? "\u{1F642}" : "\u{1F604}"}
                </span>
              )}
            </div>
            {journal.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {journal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        </div>
      )}
    </div>
  );
}
