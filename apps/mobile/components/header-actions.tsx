// apps/mobile/components/header-actions.tsx
//
// Native header actions for pushed stack screens: an optional text button
// (e.g. "Edit" / "Done") plus a "More" button that opens the platform action
// sheet (UIKit action sheet on iOS, a native dialog on Android — see
// lib/action-sheet). Replaces rows of unlabeled 32pt icon buttons, where
// Archive/Delete sat one mis-tap from Edit.
//
// Uses the stable `headerRight` screen option. expo-router's experimental
// `Stack.Toolbar` rendered NOTHING on Android (verified on device — the
// journal editor had no Done button), so it's deliberately not used.
//
// Render it anywhere inside a stack screen's component; it configures that
// screen's header.

import { Text, XStack } from "@stageholder/ui";
import { MoreHorizontal } from "@tamagui/lucide-icons-2/icons/MoreHorizontal";
import { Stack } from "expo-router";
import { Pressable } from "react-native";

import { showActionSheet } from "@/lib/action-sheet";

export type HeaderMenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function HeaderActions({
  primary,
  menu = [],
  menuTitle,
  headerTitle,
}: {
  primary?: { label: string; onPress: () => void; disabled?: boolean };
  menu?: HeaderMenuAction[];
  menuTitle?: string;
  /** Optional custom title element, set in the SAME options call. */
  headerTitle?: () => React.ReactNode;
}) {
  return (
    <Stack.Screen
      options={{
        ...(headerTitle ? { headerTitle } : {}),
        headerRight: () => (
          // RN `Pressable`, not Tamagui press props: a Tamagui `Text onPress`
          // in the native header dropped the FIRST tap after a push (the
          // handler never ran; the second tap worked — 2026-10-21), the same
          // press family that went dead on the todo checkbox.
          <XStack items="center" gap="$3">
            {primary ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={primary.label}
                disabled={primary.disabled}
                hitSlop={10}
                onPress={primary.onPress}
                style={({ pressed }) => ({
                  opacity: primary.disabled ? 0.45 : pressed ? 0.6 : 1,
                })}
              >
                <Text fontSize="$5" fontWeight="600" color="$color10">
                  {primary.label}
                </Text>
              </Pressable>
            ) : null}
            {menu.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More actions"
                hitSlop={10}
                onPress={() =>
                  showActionSheet({ title: menuTitle, actions: menu })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <MoreHorizontal size={22} color="$color" />
              </Pressable>
            ) : null}
          </XStack>
        ),
      }}
    />
  );
}
