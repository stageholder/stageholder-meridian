// Press target for an inline control inside a pressable list row (the todo
// checkbox). Web: a Tamagui View — its `onPress` maps to a bubbling click
// the row's handler guards against. Native: see `control-press.native.tsx`.

import type { ReactNode } from "react";
import { View } from "tamagui";

export interface ControlPressProps {
  label: string;
  checked: boolean;
  onPress: (e?: { stopPropagation?: () => void }) => void;
  onPressIn: () => void;
  children: ReactNode;
}

export function ControlPress({
  label,
  checked,
  onPress,
  onPressIn,
  children,
}: ControlPressProps) {
  return (
    <View
      onPress={onPress}
      onPressIn={onPressIn}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      cursor="pointer"
      {...({ hitSlop: 12 } as object)}
    >
      {children}
    </View>
  );
}
