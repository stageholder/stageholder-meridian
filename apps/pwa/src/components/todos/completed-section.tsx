import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { AnimatePresence, Text, XStack, YStack } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import type { Todo } from "@repo/core/types";

interface CompletedSectionProps {
  todos: Todo[];
}

/**
 * Collapsible "Completed (n)" group, hidden by default. Click the header to
 * reveal the finished todos (most-recently-completed first). Reuses TodoItem,
 * so un-checking a completed todo animates it back out via AnimatePresence.
 */
export function CompletedSection({ todos }: CompletedSectionProps) {
  const [open, setOpen] = useState(false);

  if (todos.length === 0) return null;

  const sorted = [...todos].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <YStack mt="$4" gap="$1">
      <XStack
        onPress={() => setOpen((v) => !v)}
        cursor="pointer"
        items="center"
        gap="$2"
        rounded="$md"
        px="$2.5"
        py="$1.5"
        transition="quick"
        hoverStyle={{ bg: "$accent" }}
        role="button"
        aria-expanded={open}
      >
        <Text color="$mutedForeground" lineHeight={0}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </Text>
        <Text
          fontSize="$1"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          Completed
        </Text>
        <Text fontSize="$1" color="$mutedForeground">
          {todos.length}
        </Text>
      </XStack>

      {open ? (
        <YStack gap="$0.5">
          <AnimatePresence>
            {sorted.map((t) => (
              <TodoItem key={t.id} todo={t} listId={t.listId} />
            ))}
          </AnimatePresence>
        </YStack>
      ) : null}
    </YStack>
  );
}
