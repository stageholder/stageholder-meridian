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
          <XStack items="center" gap="$3">
            {primary ? (
              <Text
                role="button"
                aria-label={primary.label}
                aria-disabled={primary.disabled}
                fontSize="$5"
                fontWeight="600"
                color="$color10"
                opacity={primary.disabled ? 0.45 : 1}
                hitSlop={10}
                pressStyle={{ opacity: 0.6 }}
                onPress={primary.disabled ? undefined : primary.onPress}
              >
                {primary.label}
              </Text>
            ) : null}
            {menu.length > 0 ? (
              <XStack
                role="button"
                aria-label="More actions"
                hitSlop={10}
                pressStyle={{ opacity: 0.6 }}
                focusStyle={{ outlineWidth: 0 }}
                focusVisibleStyle={{ outlineWidth: 0 }}
                onPress={() =>
                  showActionSheet({ title: menuTitle, actions: menu })
                }
              >
                <MoreHorizontal size={22} color="$color" />
              </XStack>
            ) : null}
          </XStack>
        ),
      }}
    />
  );
}
