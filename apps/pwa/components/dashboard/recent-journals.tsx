"use client";

import Link from "next/link";
import { useJournals } from "@/lib/api/journals";
import { useWorkspace } from "@/lib/workspace-context";
import { MoodDisplay } from "@/components/journal/mood-picker";
import { BentoCard } from "./bento-card";
import type { Journal } from "@repo/core/types";

export function RecentJournals({ index = 0, className }: { index?: number; className?: string }) {
  const { workspace } = useWorkspace();
  const { data: journals, isLoading } = useJournals();
  const recentJournals = (journals || []).slice(0, 5);

  return (
    <BentoCard
      title="Recent Journal Entries"
      href={`/${workspace.shortId}/journal`}
      index={index}
      className={className}
      action={
        <Link href={`/${workspace.shortId}/journal`} className="text-xs text-primary hover:underline">
          View all
        </Link>
      }
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : recentJournals.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
          {recentJournals.map((journal: Journal) => {
            const dateStr = new Date(journal.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <Link
                key={journal.id}
                href={`/${workspace.shortId}/journal/${journal.id}`}
                className="flex min-w-[160px] shrink-0 snap-start flex-col gap-1.5 rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-1.5">
                  <MoodDisplay mood={journal.mood} />
                  <span className="text-xs text-muted-foreground">{dateStr}</span>
                </div>
                <span className="line-clamp-2 text-sm font-medium text-foreground">
                  {journal.title}
                </span>
                {journal.wordCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{journal.wordCount} words</span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No journal entries yet.</p>
      )}
    </BentoCard>
  );
}
