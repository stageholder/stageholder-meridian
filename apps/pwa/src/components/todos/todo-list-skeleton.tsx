import { Skeleton, XStack, YStack } from "@stageholder/ui";

const WIDTHS = ["68%", "52%", "74%", "44%", "61%", "57%"];

/** Loading placeholder that mirrors the todo-row layout (checkbox + title). */
export function TodoListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <YStack mt="$3" gap="$2">
      {Array.from({ length: rows }).map((_, i) => (
        <XStack key={i} items="center" gap="$3" px="$2.5" py="$2">
          <Skeleton width={20} height={20} rounded={9999} />
          <Skeleton
            height={13}
            rounded="$sm"
            width={WIDTHS[i % WIDTHS.length]}
          />
        </XStack>
      ))}
    </YStack>
  );
}
