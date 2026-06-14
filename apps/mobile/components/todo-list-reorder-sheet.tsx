// apps/mobile/components/todo-list-reorder-sheet.tsx
//
// "Reorder lists" — a driven kit Sheet that lets the user drag-reorder their
// custom todo lists. The DEFAULT inbox list is excluded; it always sits first
// and is not moveable.
//
// Pattern mirrors habit-group-section.tsx (kit Sortable) +
// todo-list-sheet.tsx (native sheet rules):
//   - transition="medium" on the Sheet root (required for driven sheets)
//   - snapPointsMode="constant" + px snapPoints (never percent)
//   - Sheet.ScrollView for long list overflow
//   - NO Adapt (parks frame off-screen → overlay-only symptom)
//   - GripVertical handle from @tamagui/lucide-icons-2
//
// On drag-end: recomputes { id, order: i }[] over the new array and fires
// useReorderTodoLists.mutate immediately — no separate Save needed.

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
import type { TodoList } from "@repo/core/types";
import { GripVertical, X } from "@tamagui/lucide-icons-2";
import { useState, useEffect } from "react";

import { useReorderTodoLists } from "@/lib/api";

interface TodoListReorderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All todo lists, including the default one. The sheet filters it out. */
  lists: TodoList[];
}

export function TodoListReorderSheet({
  open,
  onOpenChange,
  lists,
}: TodoListReorderSheetProps) {
  const reorderMutation = useReorderTodoLists();

  // Custom (non-default) lists sorted by their current order field.
  const customLists = lists
    .filter((l) => !l.isDefault)
    .slice()
    .sort((a, b) => a.order - b.order);

  // Local order state so the Sortable UI updates instantly without waiting for
  // the server round-trip + invalidation.
  const [ordered, setOrdered] = useState<TodoList[]>(customLists);

  // Re-sync when the sheet opens or the upstream list changes (e.g. a new
  // list was added just before opening).
  useEffect(() => {
    setOrdered(
      lists
        .filter((l) => !l.isDefault)
        .slice()
        .sort((a, b) => a.order - b.order),
    );
  }, [lists, open]);

  function handleReorder(from: number, to: number) {
    const next = reorderItems(ordered, from, to);
    setOrdered(next);
    reorderMutation.mutate({
      items: next.map((l, i) => ({ id: l.id, order: i })),
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
            Reorder lists
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
                No custom lists yet. Tap "+ New" to create one.
              </Text>
            ) : (
              <Sortable
                items={ordered}
                keyExtractor={(l) => l.id}
                onReorder={handleReorder}
                renderItem={(list) => (
                  <View width="100%" py="$1.5">
                    <XStack
                      items="center"
                      gap="$3"
                      px="$3"
                      py="$2.5"
                      rounded="$3"
                      bg="$backgroundHover"
                    >
                      {/* Color dot */}
                      <View
                        width={10}
                        height={10}
                        rounded={9999}
                        shrink={0}
                        bg={(list.color ?? "#3b82f6") as never}
                      />

                      {/* List name */}
                      <Text
                        fontSize="$4"
                        fontWeight="500"
                        color="$color"
                        flex={1}
                        numberOfLines={1}
                      >
                        {list.name}
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
