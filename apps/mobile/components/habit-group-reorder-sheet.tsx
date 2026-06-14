// apps/mobile/components/habit-group-reorder-sheet.tsx
//
// "Reorder groups" — a driven kit Sheet that lets the user drag-reorder their
// habit groups. All groups are shown in their current order; drag to rearrange.
//
// Pattern mirrors todo-list-reorder-sheet.tsx (kit Sortable) +
// habit-group-sheet.tsx (native sheet rules):
//   - transition="medium" on the Sheet root (required for driven sheets)
//   - snapPointsMode="constant" + px snapPoints (never percent)
//   - Sheet.ScrollView for long list overflow
//   - NO Adapt (parks frame off-screen → overlay-only symptom)
//   - GripVertical handle from @tamagui/lucide-icons-2
//
// On drag-end: recomputes { id, order: i }[] over the new array and fires
// useReorderHabitGroups.mutate immediately — no separate Save needed.

import {
  Button,
  Sheet,
  Sortable,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { reorderItems } from "@stageholder/ui";
import type { HabitGroup } from "@repo/core/types";
import { GripVertical, X } from "@tamagui/lucide-icons-2";
import { useState, useEffect } from "react";

import { useReorderHabitGroups } from "@/lib/api";

interface HabitGroupReorderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All habit groups, sorted by order. */
  groups: HabitGroup[];
}

export function HabitGroupReorderSheet({
  open,
  onOpenChange,
  groups,
}: HabitGroupReorderSheetProps) {
  const reorderMutation = useReorderHabitGroups();

  // Local order state so the Sortable UI updates instantly without waiting for
  // the server round-trip + invalidation.
  const [ordered, setOrdered] = useState<HabitGroup[]>(groups);

  // Re-sync when the sheet opens or the upstream list changes (e.g. a new
  // group was added just before opening).
  useEffect(() => {
    setOrdered([...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }, [groups, open]);

  function handleReorder(from: number, to: number) {
    const next = reorderItems(ordered, from, to);
    setOrdered(next);
    reorderMutation.mutate({
      items: next.map((g, i) => ({ id: g.id, order: i })),
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      // Drag/swipe-to-close is disabled — reordering happens by dragging the
      // rows, so a stray sheet drag would be ambiguous. Close via the X.
      disableDrag
      transition="medium"
      snapPointsMode="constant"
      snapPoints={[420]}
    >
      <Sheet.Overlay />
      {/* handle={false} — no grabber (the sheet isn't draggable). */}
      <Sheet.Frame pt={0} handle={false}>
        {/* Title + close button */}
        <XStack px="$4" pt="$4" pb="$3" items="center" gap="$2">
          <Text fontSize="$6" fontWeight="700" color="$color" flex={1}>
            Reorder groups
          </Text>
          <Button
            iconOnly
            size="sm"
            intent="ghost"
            icon={<X size={20} />}
            onPress={() => onOpenChange(false)}
            aria-label="Close"
          />
        </XStack>

        <Sheet.ScrollView>
          <YStack px="$4" pb="$6" gap="$1">
            {ordered.length === 0 ? (
              <Text
                fontSize="$3"
                color="$mutedForeground"
                textAlign="center"
                py="$6"
              >
                No groups yet. Tap "+ Group" to create one.
              </Text>
            ) : (
              <Sortable
                items={ordered}
                keyExtractor={(g) => g.id}
                onReorder={handleReorder}
                renderItem={(group) => (
                  <View width="100%" py="$1.5">
                    <XStack
                      items="center"
                      gap="$3"
                      px="$3"
                      py="$2.5"
                      rounded="$3"
                      bg="$backgroundHover"
                    >
                      {/* Emoji icon or color dot */}
                      {group.icon ? (
                        <Text fontSize={14} lineHeight={14} shrink={0}>
                          {group.icon}
                        </Text>
                      ) : (
                        <View
                          width={10}
                          height={10}
                          rounded={9999}
                          shrink={0}
                          bg={(group.color ?? "#6b7280") as never}
                        />
                      )}

                      {/* Group name */}
                      <Text
                        fontSize="$4"
                        fontWeight="500"
                        color="$color"
                        flex={1}
                        numberOfLines={1}
                      >
                        {group.name}
                      </Text>

                      {/* Grip handle — visual affordance; Sortable activates on long-press */}
                      <GripVertical size={16} color="$mutedForeground" />
                    </XStack>
                  </View>
                )}
              />
            )}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
