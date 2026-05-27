import { useState } from "react";
import { Trash2 } from "lucide-react";
import { IconButton, Text, View, XStack, YStack } from "@stageholder/ui";
import { parseDateLocal } from "@/lib/date";
import { useUpdateTodo, useDeleteTodo } from "@/lib/api/todos";
import { TodoDetailDialog } from "./todo-detail-dialog";
import type { Todo } from "@repo/core/types";

// Priority badge intent tokens. The shadcn version used per-color
// bg-{c}-100/text-{c}-700 pairs; mapped onto the kit's intent palette:
// urgent→destructive, high/medium→warning (amber), low→primary (azure).
// `as const` keeps the values as literal token strings so they satisfy
// Tamagui's strict color-prop typing (arbitrary `string` is rejected).
const priorityConfig = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
  none: { label: "", bg: "$muted", color: "$mutedForeground" },
} as const;

// Warm "ignite & burn" palette. Hex (not oklch / CSS vars) so the colors
// resolve on web AND native. The whole completion effect is built from
// animated Tamagui Views, so it reproduces identically on both platforms.
const EMBER = "#f97316";
const SPARK = "#fb923c";
// Kept short so the row vanishes the instant the ignite + sparks finish —
// no dead pause before removal.
const BURN_MS = 440;

const SPARKS: { left: string; delay: number }[] = [
  { left: "18%", delay: 0 },
  { left: "34%", delay: 45 },
  { left: "50%", delay: 20 },
  { left: "66%", delay: 55 },
  { left: "82%", delay: 30 },
];

// Overlay that plays while a todo is "burning": a brief warm flash + sparks
// rising off the row. Pure Tamagui Views animated via enterStyle → the same
// on web (CSS driver) and native (Reanimated).
function CompletionBurn() {
  return (
    <>
      <View
        position="absolute"
        t={0}
        l={0}
        r={0}
        b={0}
        z={1}
        rounded="$md"
        style={{ backgroundColor: EMBER }}
        opacity={0}
        transition="medium"
        enterStyle={{ opacity: 0.22 }}
        pointerEvents="none"
      />
      {SPARKS.map((s, i) => (
        <View
          key={i}
          position="absolute"
          b={8}
          z={2}
          width={5}
          height={5}
          rounded={9999}
          style={{ backgroundColor: SPARK, left: s.left }}
          y={-22}
          opacity={0}
          transition={["medium", { delay: s.delay }] as never}
          enterStyle={{ y: 0, opacity: 1 }}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

interface TodoItemProps {
  todo: Todo;
  listId: string;
}

export function TodoItem({ todo, listId }: TodoItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [burning, setBurning] = useState(false);
  const [gone, setGone] = useState(false);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isDone = todo.status === "done";
  const priority =
    priorityConfig[todo.priority as keyof typeof priorityConfig] ??
    priorityConfig.none;

  function handleToggle(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (isDone) {
      // Un-complete: flip back immediately, no burn.
      updateTodo.mutate({ listId, todoId: todo.id, data: { status: "todo" } });
      return;
    }
    if (burning) return;
    // Play the ignite + burn first, THEN commit ("animate, then API").
    setBurning(true);
    window.setTimeout(() => {
      // Burn finished → drop the row immediately (don't wait on the mutation
      // round-trip or a second exit animation), then commit in the background.
      setGone(true);
      updateTodo.mutate({ listId, todoId: todo.id, data: { status: "done" } });
    }, BURN_MS);
  }

  function handleDelete(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    deleteTodo.mutate({ listId, todoId: todo.id });
  }

  const formattedDueDate = todo.dueDate
    ? parseDateLocal(todo.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const formattedDoDate = todo.doDate
    ? parseDateLocal(todo.doDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const isOverdue =
    todo.dueDate && !isDone && parseDateLocal(todo.dueDate) < new Date();

  // Burn already played → remove the row the instant it ends, so the list
  // closes immediately (no lingering while the mutation/exit settles).
  if (gone) return null;

  return (
    <>
      <XStack
        group
        onPress={() => !burning && setDetailOpen(true)}
        cursor="pointer"
        items="center"
        gap="$3"
        rounded="$md"
        px="$2.5"
        py="$2"
        position="relative"
        // Cross-platform enter + exit (delete / un-complete) via AnimatePresence
        // in the list views. Completion plays the burn below, then commits.
        transition={{ default: "quick", exit: "medium" }}
        enterStyle={{ opacity: 0, y: 6 }}
        exitStyle={{ opacity: 0, scale: 0.94 }}
        hoverStyle={burning ? undefined : { bg: "$accent" }}
        role="button"
        aria-label="Open todo details"
      >
        <View shrink={0} position="relative">
          <View
            onPress={handleToggle}
            width={24}
            height={24}
            items="center"
            justify="center"
            rounded={9999}
            borderWidth={2}
            transition="quick"
            borderColor={isDone ? "$primary" : "$mutedForeground"}
            bg={isDone ? "$primary" : "transparent"}
            // Burning ignites the box warm (hex → resolves on web + native).
            style={
              burning
                ? { borderColor: EMBER, backgroundColor: EMBER }
                : undefined
            }
            hoverStyle={
              !isDone && !burning ? { borderColor: "$primary" } : undefined
            }
            role="checkbox"
            aria-checked={isDone || burning}
            aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {(isDone || burning) && (
              // Checkmark pops in (Tamagui spring); currentColor → stroke.
              <View
                transition="bouncy"
                enterStyle={burning ? { scale: 0, opacity: 0 } : undefined}
              >
                <Text color="$primaryForeground" lineHeight={0}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Text>
              </View>
            )}
          </View>
          {burning && (
            // Confirming ring pulse — expands + fades on ignite.
            <View
              position="absolute"
              t={-4}
              l={-4}
              r={-4}
              b={-4}
              rounded={9999}
              borderWidth={2}
              style={{ borderColor: EMBER }}
              scale={2}
              opacity={0}
              transition="medium"
              enterStyle={{ scale: 0.6, opacity: 0.7 }}
              pointerEvents="none"
            />
          )}
        </View>

        {burning && <CompletionBurn />}

        <YStack flex={1} minW={0}>
          <Text
            fontSize="$3"
            fontWeight="500"
            color={isDone ? "$mutedForeground" : "$color"}
            textDecorationLine={isDone ? "line-through" : "none"}
          >
            {todo.title}
          </Text>
          {todo.description ? (
            <Text
              mt="$0.5"
              fontSize="$1"
              color="$mutedForeground"
              numberOfLines={1}
            >
              {todo.description}
            </Text>
          ) : null}
          {(priority.label ||
            formattedDueDate ||
            formattedDoDate ||
            (todo.subtasks && todo.subtasks.length > 0)) && (
            <XStack mt="$1.5" flexWrap="wrap" items="center" gap="$2">
              {priority.label ? (
                <Text
                  bg={priority.bg}
                  color={priority.color}
                  rounded={9999}
                  px="$2"
                  py="$0.5"
                  fontSize="$1"
                  fontWeight="500"
                >
                  {priority.label}
                </Text>
              ) : null}
              {formattedDueDate && (
                <XStack items="center" gap="$1">
                  <Text
                    color={isOverdue ? "$destructive" : "$mutedForeground"}
                    lineHeight={0}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </Text>
                  <Text
                    fontSize="$1"
                    color={isOverdue ? "$destructive" : "$mutedForeground"}
                  >
                    {formattedDueDate}
                  </Text>
                </XStack>
              )}
              {formattedDoDate && (
                <XStack items="center" gap="$1">
                  <Text color="$mutedForeground" lineHeight={0}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {formattedDoDate}
                  </Text>
                </XStack>
              )}
              {todo.subtasks && todo.subtasks.length > 0 && (
                <XStack items="center" gap="$1">
                  <Text color="$mutedForeground" lineHeight={0}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {todo.subtasks.filter((s) => s.status === "done").length}/
                    {todo.subtasks.length}
                  </Text>
                </XStack>
              )}
            </XStack>
          )}
        </YStack>

        <IconButton
          variant="ghost"
          size="sm"
          intent="danger"
          onPress={handleDelete}
          aria-label="Delete todo"
          opacity={0}
          transition="quick"
          $group-hover={{ opacity: 1 }}
        >
          <Trash2 size={14} />
        </IconButton>
      </XStack>

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todo={todo}
        listId={listId}
      />
    </>
  );
}
