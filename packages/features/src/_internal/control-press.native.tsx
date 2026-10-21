// Native press target for an inline row control (todo checkbox).
//
// WHY RN `Pressable` and not a Tamagui `View onPress`: inside the FlashList
// rows a Tamagui View's press handler intermittently never responded after a
// cold start (2026-10-21, 4 of 5 launches on iOS: the touch reached the
// view natively, no pressIn/onPress ever fired, the row around it still
// worked, and a remount via fast refresh "fixed" it). RN's own Pressable
// attaches the responder deterministically — 0 of 6 launches failed.
// `hitSlop` keeps the 44pt effective target around the 20px circle.

import { Pressable } from "react-native";
import type { ControlPressProps } from "./control-press";

export function ControlPress({
  label,
  checked,
  onPress,
  children,
}: ControlPressProps) {
  return (
    <Pressable
      onPress={() => onPress()}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}
