"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useJournals } from "@/lib/api/journals";
import { JournalList } from "@/components/journal/journal-list";
import type { Journal } from "@repo/core/types";

const moodOptions = [
  { value: 0, label: "All Moods" },
  { value: 1, label: "Terrible" },
  { value: 2, label: "Bad" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export default function JournalPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moodFilter, setMoodFilter] = useState(0);

  const queryParams = useMemo(() => {
    const params: { startDate?: string; endDate?: string } = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [startDate, endDate]);

  const { data: journals, isLoading } = useJournals(queryParams);

  const filteredJournals = useMemo(() => {
    if (!journals) return [];
    if (moodFilter === 0) return journals;
    return journals.filter((j: Journal) => j.mood === moodFilter);
  }, [journals, moodFilter]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record your thoughts and reflections.
          </p>
        </div>
        <Link
          href="/journal/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Entry
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="start-date" className="text-sm text-muted-foreground">From</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="end-date" className="text-sm text-muted-foreground">To</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="mood-filter" className="text-sm text-muted-foreground">Mood</label>
          <select
            id="mood-filter"
            value={moodFilter}
            onChange={(e) => setMoodFilter(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {moodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {(startDate || endDate || moodFilter !== 0) && (
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setMoodFilter(0);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      <JournalList journals={filteredJournals} isLoading={isLoading} />
    </div>
  );
}
