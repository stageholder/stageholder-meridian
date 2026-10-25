// packages/features/src/_internal/more-actions-sheet.native.tsx  (NATIVE)
//
// The "⋯" menu of the detail sheets as an in-app sheet nested in the detail
// sheet (stacks above it by the kit's parent-sheet contract, like the pill
// pickers). Replaces the native ActionSheetIOS menu: presenting a UIKit
// action sheet while the title's keyboard was dismissing dropped the
// presentation about one time in four (iOS 26 simulator, 2026-10-25) — the
// keyboard went down and nothing appeared. An in-app sheet has no UIKit
// presentation to lose, and its rows are the Tamagui presses every other
// sheet in the app relies on.

import { Sheet, Text, XStack, YStack } from "@stageholder/ui";

import type { MoreAction } from "./more-actions.types";
import { useAndroidBackClose } from "./use-android-back-close";
import { KeyboardSpacer } from "./composer-sheet.native";

export type { MoreAction };

export interface MoreActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: MoreAction[];
}

export function MoreActionsSheet({
  open,
  onOpenChange,
  title,
  actions,
}: MoreActionsSheetProps) {
  useAndroidBackClose(open, () => onOpenChange(false));
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
      // Root mounted while closed (`open` policy): a nested sheet whose root
      // mounts in the same commit it opens sometimes showed its overlay but
      // never its frame (second "⋯" open, 2026-10-25) — the kit's lazy root
      // isn't reliable for sheets nested in another sheet. Children still
      // unmount at close, so a closed picker costs only its root.
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$1">
        <Text
          fontSize="$5"
          fontWeight="600"
          color="$color"
          pb="$2"
          numberOfLines={1}
        >
          {title}
        </Text>
        <YStack gap="$1">
          {actions.map((a) => (
            <XStack
              key={a.label}
              role="button"
              aria-label={a.label}
              onPress={() => {
                onOpenChange(false);
                a.onPress();
              }}
              items="center"
              gap="$3"
              py="$3"
              px="$2"
              rounded="$3"
              pressStyle={{ bg: "$secondary" }}
            >
              {a.icon}
              <Text
                fontSize="$4"
                color={a.destructive ? "$destructive" : "$color"}
                flex={1}
                numberOfLines={1}
              >
                {a.label}
              </Text>
            </XStack>
          ))}
          <XStack
            role="button"
            aria-label="Cancel"
            onPress={() => onOpenChange(false)}
            items="center"
            justify="center"
            py="$3"
            rounded="$3"
            pressStyle={{ bg: "$secondary" }}
          >
            <Text fontSize="$4" fontWeight="500" color="$mutedForeground">
              Cancel
            </Text>
          </XStack>
        </YStack>
        {/* Rises above a keyboard the host leaves up (see KeyboardSpacer). */}
        <KeyboardSpacer />
      </Sheet.Frame>
    </Sheet>
  );
}
