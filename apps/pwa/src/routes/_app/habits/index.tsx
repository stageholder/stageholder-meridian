import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { LayoutGrid, List as ListIcon, Plus, Target } from "lucide-react";
import {
  Button,
  EmptyState,
  SegmentedControl,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useHabits } from "@/lib/api/habits";
import { HabitCard } from "@/components/habits/habit-card";
import { HabitListItem } from "@/components/habits/habit-list-item";
import { HabitDateNav } from "@/components/habits/habit-date-nav";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { CreateFab } from "@/components/shared/create-fab";
import { parseDateLocal } from "@/lib/date";
import type { Habit } from "@repo/core/types";

type HabitViewMode = "card" | "list";

/**
 * `useState` rather than localStorage for now — most users stick with
 * one mode per session. Promoting to a persisted preference is a one-line
 * change (swap to a Zustand slice or a `useLocalStorage` hook) once
 * habits + view-mode telemetry justifies it.
 */
const DEFAULT_VIEW_MODE: HabitViewMode = "card";

export const Route = createFileRoute("/_app/habits/")({
  component: HabitsPage,
});

function HabitsPage() {
  const { data: habits, isLoading } = useHabits();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<HabitViewMode>(DEFAULT_VIEW_MODE);

  const isViewingToday = selectedDate === todayStr;

  return (
    <YStack gap="$6" p="$4">
      {/* Header — the date filter (left), view-mode toggle + New Habit
          (right). No page title; the app bar already reads "Habits". */}
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <XStack items="center" gap="$3" flexWrap="wrap">
          <HabitDateNav
            value={parseDateLocal(selectedDate)}
            onChange={(d) => setSelectedDate(format(d, "yyyy-MM-dd"))}
          />
          {!isViewingToday && (
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setSelectedDate(todayStr)}
            >
              Back to today
            </Button>
          )}
        </XStack>
        <XStack items="center" gap="$2">
          {/* View toggle — kit SegmentedControl (alpha.8 renders icon-only
              segments un-clamped; `currentColor` icons inherit the active
              $primaryForeground / inactive $mutedForeground color).
              · `height="$md"` matches the New Habit button's height token
                exactly, so the two controls share a baseline.
              · `display:block` drops each SVG's inline baseline gap so it sits
                dead-center — the kit wraps icon children in a Text, which would
                otherwise baseline-align (push) the glyph upward. `px` gives the
                active pill horizontal breathing room; vertical centering comes
                from the fixed Frame height + the segment's `items:center`. */}
          <SegmentedControl
            size="$3"
            height="$md"
            fitContent
            value={viewMode}
            onValueChange={(v) => setViewMode(v as HabitViewMode)}
          >
            <SegmentedControl.Item
              value="card"
              aria-label="Card view"
              px="$2.5"
            >
              <LayoutGrid
                size={16}
                color="currentColor"
                style={{ display: "block" }}
              />
            </SegmentedControl.Item>
            <SegmentedControl.Item
              value="list"
              aria-label="List view"
              px="$2.5"
            >
              <ListIcon
                size={16}
                color="currentColor"
                style={{ display: "block" }}
              />
            </SegmentedControl.Item>
          </SegmentedControl>
          {/* Desktop only — on mobile the create affordance is the FAB below. */}
          <Button
            display="none"
            $md={{ display: "flex" }}
            borderWidth={0}
            {...({ color: "#ffffff" } as object)}
            icon={<Plus size={16} color="#ffffff" />}
            style={{ backgroundColor: "var(--ring-habit)" }}
            hoverStyle={
              { backgroundColor: "var(--ring-habit)", opacity: 0.9 } as never
            }
            pressStyle={
              {
                backgroundColor: "var(--ring-habit)",
                opacity: 0.82,
                scale: 0.96,
              } as never
            }
            onPress={() => setShowCreateDialog(true)}
          >
            New Habit
          </Button>
        </XStack>
      </XStack>

      {isLoading ? (
        viewMode === "card" ? (
          // Card-mode skeleton — responsive grid: 1 col mobile, 2 col
          // tablet (≥ $md), 3 col desktop (≥ $lg). Explicit per-breakpoint
          // width (not `flex={1}`) so a single card sits in the top-left
          // at its natural column width, matching the loaded state.
          <XStack flexWrap="wrap" gap="$4">
            {[1, 2, 3].map((i) => (
              <YStack
                key={i}
                width="100%"
                $md={{ width: "49%" }}
                $lg={{ width: "32%" }}
                rounded="$6"
                borderWidth={1}
                borderColor="$borderColor"
                bg="$card"
                p="$5"
              >
                <XStack items="center" gap="$3">
                  {/* allowlist: animate-pulse keyframe (Tailwind/globals) */}
                  <View
                    height={40}
                    width={40}
                    rounded="$lg"
                    bg="$muted"
                    className="animate-pulse"
                  />
                  <YStack gap="$2">
                    <View
                      height={16}
                      width={96}
                      rounded="$sm"
                      bg="$muted"
                      className="animate-pulse"
                    />
                    <View
                      height={13}
                      width={128}
                      rounded="$sm"
                      bg="$muted"
                      className="animate-pulse"
                    />
                  </YStack>
                </XStack>
                <YStack mt="$4" gap="$2">
                  <View
                    height={8}
                    width="100%"
                    rounded={9999}
                    bg="$muted"
                    className="animate-pulse"
                  />
                </YStack>
                <XStack mt="$3" justify="space-between">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <YStack key={d} items="center" gap="$1">
                      <View
                        height={10}
                        width={10}
                        rounded="$sm"
                        bg="$muted"
                        className="animate-pulse"
                      />
                      <View
                        height={14}
                        width={14}
                        rounded={9999}
                        bg="$muted"
                        className="animate-pulse"
                      />
                    </YStack>
                  ))}
                </XStack>
                <XStack mt="$4" items="center" justify="space-between">
                  <View
                    height={13}
                    width={64}
                    rounded="$sm"
                    bg="$muted"
                    className="animate-pulse"
                  />
                  <View
                    height={28}
                    width={64}
                    rounded="$lg"
                    bg="$muted"
                    className="animate-pulse"
                  />
                </XStack>
              </YStack>
            ))}
          </XStack>
        ) : (
          // List-mode skeleton — 3 short rows so the loading layout
          // matches the loaded list layout.
          <YStack gap="$2">
            {[1, 2, 3].map((i) => (
              <XStack
                key={i}
                items="center"
                gap="$3"
                py="$3"
                px="$3.5"
                rounded="$4"
                borderWidth={1}
                borderColor="$borderColor"
                bg="$card"
              >
                <View
                  width={36}
                  height={36}
                  rounded="$lg"
                  bg="$muted"
                  className="animate-pulse"
                />
                <YStack flex={1} gap="$1.5">
                  <View
                    height={14}
                    width={160}
                    rounded="$sm"
                    bg="$muted"
                    className="animate-pulse"
                  />
                  <View
                    height={10}
                    width={100}
                    rounded="$sm"
                    bg="$muted"
                    className="animate-pulse"
                  />
                </YStack>
                <View
                  height={28}
                  width={88}
                  rounded="$lg"
                  bg="$muted"
                  className="animate-pulse"
                />
              </XStack>
            ))}
          </YStack>
        )
      ) : habits && habits.length > 0 ? (
        viewMode === "card" ? (
          // Card mode — responsive grid: 1 col mobile, 2 col tablet
          // (≥ $md), 3 col desktop (≥ $lg). Each card is wrapped in a
          // sized View — the HabitCard view itself stays platform-
          // agnostic (its only layout hints are `flex` + `minW`), and
          // the host owns the column strategy. `flex={1}` inside the
          // View makes the card fill its assigned column.
          <XStack flexWrap="wrap" gap="$4">
            {habits.map((habit: Habit) => (
              <View
                key={habit.id}
                width="100%"
                $md={{ width: "49%" }}
                $lg={{ width: "32%" }}
              >
                <HabitCard
                  habit={habit}
                  flex={1}
                  minW={0}
                  selectedDate={isViewingToday ? undefined : selectedDate}
                />
              </View>
            ))}
          </XStack>
        ) : (
          // List mode — vertical stack of compact rows. One row per
          // habit, full content width. Density wins over visuals; the
          // weekly dot strip + burst animations from the card view are
          // traded for scannability.
          <YStack gap="$2">
            {habits.map((habit: Habit) => (
              <HabitListItem
                key={habit.id}
                habit={habit}
                selectedDate={isViewingToday ? undefined : selectedDate}
              />
            ))}
          </YStack>
        )
      ) : (
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>No habits yet</EmptyState.Title>
          <EmptyState.Description>
            Create one to start tracking your progress.
          </EmptyState.Description>
        </EmptyState>
      )}

      {/* Mobile create affordance — opens the same dialog as the desktop button. */}
      <CreateFab
        label="New habit"
        tintVar="--ring-habit"
        onPress={() => setShowCreateDialog(true)}
      />

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </YStack>
  );
}
