// apps/mobile/components/todos/ListChips.tsx
//
// Horizontal scrolling chip row for filtering todos by list. Mirrors the
// PWA's TodoListSidebar but flattened to a 1D row for mobile.
//
//   [ ● All  5 ] [ ● Inbox  3 ] [ ● Work  2 ] [ ● Personal  0 ]
//
// Only renders when the user has more than one list — when it's just
// Inbox, the chip row is dead weight. The "All" pseudo-chip is always
// first and clears the list filter (selectedListId === null).
//
// Active chip is filled in the list color; inactive chips show only a
// small color dot so the row stays scannable.

import { Text, View, XStack, useHaptic } from "@stageholder/ui";
import type { TodoList } from "@repo/core/types";
import { Pressable, ScrollView } from "react-native";

export type ListChipsProps = {
  lists: TodoList[];
  /** `null` = "All", a list id = filter to that list. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Per-list open-todo counts (excluding done). Drives the badge number. */
  counts?: Record<string, number>;
};

const DEFAULT_DOT = "#7c89b6";

export function ListChips({ lists, value, onChange, counts }: ListChipsProps) {
  const haptic = useHaptic();

  // Hide entirely if the user only has Inbox (or fewer) — the filter is
  // a no-op and a UI row just to show "Inbox" is noise.
  if (lists.length <= 1) return null;

  // Order: Inbox first (it's always present and the default), then the
  // rest in creation order. Server returns them in createdAt order.
  const ordered = [...lists].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return 0;
  });

  const total = counts
    ? Object.values(counts).reduce((s, n) => s + n, 0)
    : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
    >
      <Chip
        active={value === null}
        color={null}
        label="All"
        count={total}
        onPress={() => {
          haptic.selection();
          onChange(null);
        }}
      />
      {ordered.map((l) => (
        <Chip
          key={l.id}
          active={value === l.id}
          color={l.color ?? DEFAULT_DOT}
          label={l.name}
          count={counts?.[l.id] ?? null}
          onPress={() => {
            haptic.selection();
            onChange(l.id);
          }}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  active,
  color,
  label,
  count,
  onPress,
}: {
  active: boolean;
  color: string | null;
  label: string;
  count: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        items="center"
        gap={6}
        px="$3"
        py="$1.5"
        rounded="$3"
        bg={(active ? "$color5" : "$color2") as never}
        borderWidth={1}
        borderColor={(active ? "$color8" : "$color6") as never}
      >
        {color ? (
          <View
            width={8}
            height={8}
            rounded={4}
            bg={color as never}
            opacity={active ? 1 : 0.7}
          />
        ) : null}
        <Text
          fontSize="$2"
          fontWeight={active ? "600" : "500"}
          color={(active ? "$color12" : "$color11") as never}
        >
          {label}
        </Text>
        {count != null && count > 0 ? (
          <Text
            fontSize={10}
            fontFamily="$mono"
            color="$color11"
            fontWeight="600"
          >
            {count}
          </Text>
        ) : null}
      </XStack>
    </Pressable>
  );
}
