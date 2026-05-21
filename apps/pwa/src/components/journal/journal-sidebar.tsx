import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useJournals, useJournalsPaginated } from "@/lib/api/journals";
import { JournalList } from "@/components/journal/journal-list";
import { DatePicker } from "@/components/ui/date-picker";
import type { Journal } from "@repo/core/types";
import { Button, Select } from "@stageholder/ui";

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
  const navigate = useNavigate();
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

  const dateRangeQuery = useJournals(hasDateFilter ? queryParams : undefined, {
    enabled: hasDateFilter,
  });
  const paginatedQuery = useJournalsPaginated();

  const journals: Journal[] = useMemo(() => {
    if (hasDateFilter) {
      return dateRangeQuery.data ?? [];
    }
    if (!paginatedQuery.data) return [];
    return paginatedQuery.data.pages.flatMap((page) => page.data);
  }, [hasDateFilter, dateRangeQuery.data, paginatedQuery.data]);

  const isLoading = hasDateFilter
    ? dateRangeQuery.isLoading
    : paginatedQuery.isLoading;

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
          <Button
            size="sm"
            onPress={() => void navigate({ to: "/journal/new" })}
          >
            New Journal
          </Button>
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
          <Select
            value={String(moodFilter)}
            onValueChange={(value) => setMoodFilter(Number(value))}
          >
            <Select.Trigger className="h-7 w-auto rounded-lg border-border bg-background px-2 text-xs" />
            <Select.Content>
              {moodOptions.map((opt) => (
                <Select.Item key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {(startDate || endDate || moodFilter !== 0) && (
            <Button
              intent="ghost"
              size="sm"
              onPress={() => {
                setStartDate("");
                setEndDate("");
                setMoodFilter(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <JournalList
          journals={filteredJournals}
          isLoading={isLoading}
          activeId={activeId}
        />
        {!hasDateFilter && paginatedQuery.hasNextPage && (
          <div className="mt-2 flex justify-center">
            <Button
              intent="ghost"
              size="sm"
              onPress={() => paginatedQuery.fetchNextPage()}
              disabled={paginatedQuery.isFetchingNextPage}
              loading={paginatedQuery.isFetchingNextPage}
              loadingText="Loading…"
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
