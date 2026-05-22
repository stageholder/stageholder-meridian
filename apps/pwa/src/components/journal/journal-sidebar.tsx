import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { useJournals, useJournalsPaginated } from "@/lib/api/journals";
import { JournalList } from "@/components/journal/journal-list";
import { parseDateLocal } from "@/lib/date";
import type { Journal } from "@repo/core/types";
import {
  Button,
  DatePicker,
  Select,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";

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
    <YStack height="100%">
      {/* Header */}
      <YStack
        shrink={0}
        p="$4"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" justify="space-between">
          <YStack>
            <Text fontSize="$6" fontWeight="600" color="$color">
              Journal
            </Text>
            <Text fontSize="$1" color="$mutedForeground">
              Your thoughts and reflections
            </Text>
          </YStack>
          <Button
            size="sm"
            onPress={() => void navigate({ to: "/journal/new" })}
          >
            New Journal
          </Button>
        </XStack>

        {/* Filters */}
        <XStack mt="$3" flexWrap="wrap" items="center" gap="$2">
          <XStack items="center" gap="$1.5">
            <Text fontSize="$1" color="$mutedForeground">
              From
            </Text>
            <DatePicker
              value={startDate ? parseDateLocal(startDate) : null}
              onChange={(d) => setStartDate(d ? format(d, "yyyy-MM-dd") : "")}
              placeholder="Start"
              showClear
            />
          </XStack>
          <XStack items="center" gap="$1.5">
            <Text fontSize="$1" color="$mutedForeground">
              To
            </Text>
            <DatePicker
              value={endDate ? parseDateLocal(endDate) : null}
              onChange={(d) => setEndDate(d ? format(d, "yyyy-MM-dd") : "")}
              placeholder="End"
              showClear
            />
          </XStack>
          <Select
            value={String(moodFilter)}
            onValueChange={(value) => setMoodFilter(Number(value))}
          >
            <Select.Trigger height={28} rounded="$lg" px="$2" fontSize="$1" />
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
        </XStack>
      </YStack>

      {/* Scrollable list */}
      <YStack flex={1} overflow="scroll" p="$3">
        <JournalList
          journals={filteredJournals}
          isLoading={isLoading}
          activeId={activeId}
        />
        {!hasDateFilter && paginatedQuery.hasNextPage && (
          <XStack mt="$2" justify="center">
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
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}
