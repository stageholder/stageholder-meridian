// apps/mobile/components/habit-group-chips.tsx
//
// Horizontal chips rail for the habits screen — native mirror of the PWA's
// habits sidebar/group surface (apps/pwa/src/components/habits/habits-sidebar.tsx
// + the $groupId / archived routes), condensed into one chips row exactly like
// the todos screen's list rail (apps/mobile/app/(authed)/todos.tsx).
//
// Layout: All · each group (color dot + name) · pencil-on-active-group ·
// "+ group" · "Archived". Tapping a chip sets the active filter; tapping the
// pencil on the active group opens its edit sheet.

import { Pill, Text, View, XStack } from "@stageholder/ui";
import type { HabitGroup } from "@repo/core/types";
import { Archive, Pencil, Plus } from "@tamagui/lucide-icons-2";
import { ScrollView as RNScrollView } from "react-native";

/** The synthetic chip value for the Archived view. */
export const ARCHIVED_CHIP = "__archived__" as const;

/** Active selection: null = All, ARCHIVED_CHIP = Archived view, else a groupId. */
export type HabitChipSelection = string | null;

interface HabitGroupChipsProps {
  groups: HabitGroup[];
  /** null = All; ARCHIVED_CHIP = Archived; otherwise a real group id. */
  active: HabitChipSelection;
  onSelect: (selection: HabitChipSelection) => void;
  /** Open the edit sheet for the active group (pencil chip). */
  onEditActive: (group: HabitGroup) => void;
  /** Open the create-group sheet ("+ group" chip). */
  onCreate: () => void;
}

export function HabitGroupChips({
  groups,
  active,
  onSelect,
  onEditActive,
  onCreate,
}: HabitGroupChipsProps) {
  const activeGroup =
    active && active !== ARCHIVED_CHIP
      ? (groups.find((g) => g.id === active) ?? null)
      : null;

  return (
    <RNScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // RN ScrollView defaults to flexGrow:1 — in this flex column it would
      // split the leftover height with the PullToRefresh scroller, stranding
      // the chips mid-screen. Hug the rail's content height (todos.tsx idiom).
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        alignItems: "center",
      }}
    >
      <Pill size="sm" selected={active === null} onPress={() => onSelect(null)}>
        All
      </Pill>

      {groups.map((group) => (
        <Pill
          key={group.id}
          size="sm"
          selected={active === group.id}
          onPress={() => onSelect(group.id)}
        >
          <XStack items="center" gap="$1.5">
            {group.icon ? (
              <Text fontSize={12} lineHeight={12}>
                {group.icon}
              </Text>
            ) : (
              <View
                width={8}
                height={8}
                rounded={9999}
                style={{ backgroundColor: group.color ?? "#6b7280" }}
              />
            )}
            <Text fontSize="$2" color="$color">
              {group.name}
            </Text>
          </XStack>
        </Pill>
      ))}

      {/* Pencil — only when a real group is the active filter. */}
      {activeGroup ? (
        <Pill
          size="sm"
          onPress={() => onEditActive(activeGroup)}
          aria-label={`Edit group ${activeGroup.name}`}
        >
          <Pencil size={12} color="$mutedForeground" />
        </Pill>
      ) : null}

      <Pill size="sm" onPress={onCreate}>
        <XStack items="center" gap="$1">
          <Plus size={12} color="$mutedForeground" />
          <Text fontSize="$2" color="$mutedForeground">
            Group
          </Text>
        </XStack>
      </Pill>

      <Pill
        size="sm"
        selected={active === ARCHIVED_CHIP}
        onPress={() => onSelect(ARCHIVED_CHIP)}
      >
        <XStack items="center" gap="$1">
          <Archive size={12} color="$mutedForeground" />
          <Text fontSize="$2" color="$mutedForeground">
            Archived
          </Text>
        </XStack>
      </Pill>
    </RNScrollView>
  );
}
