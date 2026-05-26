import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useJournals, useJournalsPaginated } from "@/lib/api/journals";
import { JournalList } from "@/components/journal/journal-list";
import { parseDateLocal } from "@/lib/date";
import type { Journal } from "@repo/core/types";
import {
  Button,
  DatePicker,
  Popover,
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
  // Active-filter count drives the trigger label ("Filter (2)") so the
  // collapsed control still signals that filters are applied.
  const activeFilterCount =
    (hasDateFilter ? 1 : 0) + (moodFilter !== 0 ? 1 : 0);

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
      {/* Header — no redundant title (the app bar already says "Journal").
          New Journal carries the journal identity color (yellow); all
          filters collapse into one Filter popover to keep the rail compact. */}
      <YStack
        shrink={0}
        p="$4"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$2">
          <Button
            size="sm"
            flex={1}
            borderWidth={0}
            // Journal identity = yellow; it's a light hue, so the label/icon
            // go near-black for contrast (mirrors the todo-red Add button).
            color={"#1c1917" as never}
            icon={<Plus size={15} color="#1c1917" />}
            style={{ backgroundColor: "var(--ring-journal)" }}
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.82, scale: 0.96 }}
            onPress={() => void navigate({ to: "/journal/new" })}
          >
            New Journal
          </Button>

          <Popover placement="bottom-end">
            <Popover.Trigger asChild>
              <Button
                intent="outline"
                size="sm"
                icon={<SlidersHorizontal size={14} />}
              >
                {activeFilterCount > 0
                  ? `Filter (${activeFilterCount})`
                  : "Filter"}
              </Button>
            </Popover.Trigger>
            <Popover.Content
              width={300}
              p="$3"
              // Keep the filter popover open while interacting with a nested
              // DatePicker calendar / Select listbox (both render their own
              // popover-content portals).
              onPointerDownOutside={(e: {
                target: EventTarget | null;
                preventDefault: () => void;
              }) => {
                const target = e.target as Element;
                if (target.closest('[data-slot="popover-content"]'))
                  e.preventDefault();
              }}
              onInteractOutside={(e: {
                target: EventTarget | null;
                preventDefault: () => void;
              }) => {
                const target = e.target as Element;
                if (target.closest('[data-slot="popover-content"]'))
                  e.preventDefault();
              }}
            >
              <YStack gap="$3">
                <XStack items="center" justify="space-between">
                  <Text fontSize="$2" fontWeight="600" color="$color">
                    Filters
                  </Text>
                  {activeFilterCount > 0 && (
                    <Button
                      intent="ghost"
                      size="sm"
                      onPress={() => {
                        setStartDate("");
                        setEndDate("");
                        setMoodFilter(0);
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                </XStack>

                <YStack gap="$1.5">
                  <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                    Date range
                  </Text>
                  <YStack gap="$2">
                    <DatePicker
                      value={startDate ? parseDateLocal(startDate) : null}
                      onChange={(d) =>
                        setStartDate(d ? format(d, "yyyy-MM-dd") : "")
                      }
                      placeholder="Start date"
                      showClear
                    />
                    <DatePicker
                      value={endDate ? parseDateLocal(endDate) : null}
                      onChange={(d) =>
                        setEndDate(d ? format(d, "yyyy-MM-dd") : "")
                      }
                      placeholder="End date"
                      showClear
                    />
                  </YStack>
                </YStack>

                <YStack gap="$1.5">
                  <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                    Mood
                  </Text>
                  <Select
                    value={String(moodFilter)}
                    onValueChange={(value) => setMoodFilter(Number(value))}
                  >
                    <Select.Trigger width="100%" />
                    <Select.Content>
                      {moodOptions.map((opt) => (
                        <Select.Item key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </YStack>
              </YStack>
            </Popover.Content>
          </Popover>
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
