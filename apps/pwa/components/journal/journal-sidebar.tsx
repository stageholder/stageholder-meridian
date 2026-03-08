"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useJournals, useJournalsPaginated } from "@/lib/api/journals";
import { JournalList } from "@/components/journal/journal-list";
import { DatePicker } from "@/components/ui/date-picker";
import { useWorkspace } from "@/lib/workspace-context";
import type { Journal } from "@repo/core/types";

const moodOptions = [
  { value: 0, label: "All Moods" },
  { value: 1, label: "Terrible" },
  { value: 2, label: "Bad" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

interface JournalSidebarProps {
  activeId?: string;
}

export function JournalSidebar({ activeId }: JournalSidebarProps) {
  const { workspace } = useWorkspace();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moodFilter, setMoodFilter] = useState(0);

  const hasDateFilter = !!(startDate || endDate);

  const queryParams = useMemo(() => {
    const params: { startDate?: string; endDate?: string } = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [startDate, endDate]);

  const dateRangeQuery = useJournals(hasDateFilter ? queryParams : undefined, { enabled: hasDateFilter });
  const paginatedQuery = useJournalsPaginated();

  const journals: Journal[] = useMemo(() => {
    if (hasDateFilter) {
      return dateRangeQuery.data ?? [];
    }
    if (!paginatedQuery.data) return [];
    return paginatedQuery.data.pages.flatMap((page) => page.data);
  }, [hasDateFilter, dateRangeQuery.data, paginatedQuery.data]);

  const isLoading = hasDateFilter ? dateRangeQuery.isLoading : paginatedQuery.isLoading;

  const filteredJournals = useMemo(() => {
    if (moodFilter === 0) return journals;
    return journals.filter((j: Journal) => j.mood === moodFilter);
  }, [journals, moodFilter]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Journal</h2>
            <p className="text-xs text-muted-foreground">
              Your thoughts and reflections
            </p>
          </div>
          <Link
            href={`/${workspace.shortId}/journal/new`}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Journal
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Start"
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="End"
              className="w-auto"
            />
          </div>
          <select
            value={moodFilter}
            onChange={(e) => setMoodFilter(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {moodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {(startDate || endDate || moodFilter !== 0) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setMoodFilter(0);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3">
        <JournalList
          journals={filteredJournals}
          isLoading={isLoading}
          activeId={activeId}
        />
        {!hasDateFilter && paginatedQuery.hasNextPage && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => paginatedQuery.fetchNextPage()}
              disabled={paginatedQuery.isFetchingNextPage}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {paginatedQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
