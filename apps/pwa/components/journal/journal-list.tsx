"use client";

import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { MoodDisplay } from "./mood-picker";
import type { Journal } from "@repo/core/types";

interface JournalListProps {
  journals: Journal[];
  isLoading: boolean;
  activeId?: string;
}

export function JournalList({ journals, isLoading, activeId }: JournalListProps) {
  const { workspace } = useWorkspace();
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading journal entries...</div>;
  }

  if (journals.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No journal entries yet. Write your first entry to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {journals.map((journal) => {
        const dateStr = new Date(journal.date).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        // Strip HTML tags for preview
        const plainText = journal.content.replace(/<[^>]*>/g, "");
        const preview = plainText.length > 150 ? plainText.slice(0, 150) + "..." : plainText;

        return (
          <Link
            key={journal.id}
            href={`/${workspace.shortId}/journal/${journal.id}`}
            className={cn(
              "block rounded-lg border p-4 transition-colors",
              journal.id === activeId
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card hover:bg-accent/50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {journal.title}
                  </h3>
                  <MoodDisplay mood={journal.mood} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{preview}</p>
              </div>
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
          </Link>
        );
      })}
    </div>
  );
}
