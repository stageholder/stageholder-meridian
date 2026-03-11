"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  isThisWeek,
  isThisYear,
} from "date-fns";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { MoodDisplay } from "./mood-picker";
import type { Journal } from "@repo/core/types";

interface JournalListProps {
  journals: Journal[];
  isLoading: boolean;
  activeId?: string;
}

function getDateGroup(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "This Week";
  if (isThisYear(date)) return format(date, "MMMM");
  return format(date, "MMMM yyyy");
}

export function JournalList({
  journals,
  isLoading,
  activeId,
}: JournalListProps) {
  const { workspace } = useWorkspace();

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
      <div className="text-sm text-muted-foreground">
        Loading journal entries...
      </div>
    );
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
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.entries.map((journal) => {
              const dateLabel = format(parseISO(journal.date), "EEE, MMM d");
              const plainText = journal.content.replace(/<[^>]*>/g, "");
              const preview =
                plainText.length > 120
                  ? plainText.slice(0, 120) + "..."
                  : plainText;

              return (
                <Link
                  key={journal.id}
                  href={`/${workspace.shortId}/journal/${journal.id}`}
                  className={cn(
                    "block rounded-lg border p-3 transition-colors",
                    journal.id === activeId
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:bg-accent/50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {journal.title}
                    </h4>
                    <MoodDisplay mood={journal.mood} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dateLabel}
                  </p>
                  {preview && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {preview}
                    </p>
                  )}
                  {journal.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {journal.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
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
        </div>
      ))}
    </div>
  );
}
