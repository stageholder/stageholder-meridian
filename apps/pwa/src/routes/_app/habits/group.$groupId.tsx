import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List as ListIcon, Plus, Target } from "lucide-react";
import {
  Button,
  EmptyState,
  SegmentedControl,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useHabits } from "@/lib/api/habits";
import { useHabitGroups } from "@/lib/api/habit-groups";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { MoveToGroupDialog } from "@/components/habits/move-to-group-dialog";
import {
  HabitGroupSection,
  type HabitViewMode,
} from "@/components/habits/habit-group-section";
import { CreateFab } from "@/components/shared/create-fab";
import type { Habit } from "@repo/core/types";

const DEFAULT_VIEW_MODE: HabitViewMode = "card";

export const Route = createFileRoute("/_app/habits/group/$groupId")({
  component: HabitGroupPage,
});

/**
 * Single-group view — one vertical `Sortable` of the group's habits. Header is
 * the group name + color dot; EmptyState when the group has no habits. New
 * habits created here default to this group.
 */
function HabitGroupPage() {
  const { groupId } = Route.useParams();
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: groups, isLoading: groupsLoading } = useHabitGroups();
  const isLoading = habitsLoading || groupsLoading;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Habit | null>(null);
  const [viewMode, setViewMode] = useState<HabitViewMode>(DEFAULT_VIEW_MODE);

  const group = groups?.find((g) => g.id === groupId);

  const groupHabits = useMemo(
    () =>
      ((habits ?? []) as Habit[])
        .filter((h) => h.groupId === groupId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [habits, groupId],
  );

  return (
    <YStack gap="$6" p="$4">
      {/* Header — emoji (when set) or color dot + group name (left), view toggle + New (right). */}
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <XStack items="center" gap="$2.5">
          {group?.icon ? (
            <Text fontSize={20} lineHeight={20} shrink={0}>
              {group.icon}
            </Text>
          ) : (
            <View
              width={12}
              height={12}
              rounded={9999}
              shrink={0}
              style={{ backgroundColor: group?.color || "#6b7280" }}
            />
          )}
          <Text fontSize="$7" fontWeight="700" color="$color">
            {group?.name ?? "Group"}
          </Text>
        </XStack>
        <XStack items="center" gap="$2">
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
        // Loading skeleton — a vertical column of placeholder cards, matching
        // the index route's loading idiom + this view's vertical Sortable.
        <YStack gap="$3">
          {[1, 2, 3].map((i) => (
            <YStack
              key={i}
              width="100%"
              rounded="$6"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$card"
              p="$5"
            >
              <XStack items="center" gap="$3">
                <Skeleton height={40} width={40} rounded="$lg" />
                <YStack gap="$2">
                  <Skeleton height={16} width={96} rounded="$sm" />
                  <Skeleton height={13} width={128} rounded="$sm" />
                </YStack>
              </XStack>
              <YStack mt="$4" gap="$2">
                <Skeleton height={8} width="100%" rounded={9999} />
              </YStack>
            </YStack>
          ))}
        </YStack>
      ) : !group ? (
        // Resolved, but the group doesn't exist (deleted or invalid id).
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>Group not found</EmptyState.Title>
          <EmptyState.Description>
            This group may have been deleted. Pick another from the sidebar.
          </EmptyState.Description>
        </EmptyState>
      ) : groupHabits.length > 0 ? (
        <HabitGroupSection
          habits={groupHabits}
          groupId={groupId}
          viewMode={viewMode}
          onMoveToGroup={setMoveTarget}
        />
      ) : (
        <EmptyState>
          <EmptyState.IconSlot>
            <Target size={20} />
          </EmptyState.IconSlot>
          <EmptyState.Title>No habits in this group</EmptyState.Title>
          <EmptyState.Description>
            Add a habit here, or move one in from its menu.
          </EmptyState.Description>
        </EmptyState>
      )}

      <CreateFab
        label="New habit"
        tintVar="--ring-habit"
        onPress={() => setShowCreateDialog(true)}
      />

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultGroupId={groupId}
      />

      <MoveToGroupDialog
        habit={moveTarget}
        open={!!moveTarget}
        onOpenChange={(o) => {
          if (!o) setMoveTarget(null);
        }}
      />
    </YStack>
  );
}
