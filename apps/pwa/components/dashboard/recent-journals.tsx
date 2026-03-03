"use client";

import Link from "next/link";
import { useJournals } from "@/lib/api/journals";
import { MoodDisplay } from "@/components/journal/mood-picker";
import type { Journal } from "@repo/core/types";

export function RecentJournals() {
  const { data: journals, isLoading } = useJournals();
  const recentJournals = (journals || []).slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recent Journal Entries</h3>
        <Link href="/journal" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : recentJournals.length > 0 ? (
          recentJournals.map((journal: Journal) => {
            const dateStr = new Date(journal.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <Link
                key={journal.id}
                href={`/journal/${journal.id}`}
                className="block rounded-lg p-2 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {journal.title}
                    </span>
                    <MoodDisplay mood={journal.mood} />
                  </div>
                  <span className="text-xs text-muted-foreground">{dateStr}</span>
                </div>
              </Link>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">No journal entries yet.</p>
        )}
      </div>
    </div>
  );
}
