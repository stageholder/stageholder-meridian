// apps/mobile/lib/haptic-impl.ts
//
// Adapter that bridges @stageholder/ui's intent-based haptic API to
// expo-haptics. Wired into HapticProvider in app/_layout.tsx so every
// component below (FAB, MoodPicker, SwipeableRow, etc.) gets real iOS
// Taptic Engine + Android haptic feedback automatically.

import * as Haptics from "expo-haptics";
import type { HapticImpl } from "@stageholder/ui";

export const expoHapticImpl: HapticImpl = {
  impact: (style) =>
    Haptics.impactAsync(
      style === "heavy"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : style === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
    ),
  notification: (type) =>
    Haptics.notificationAsync(
      type === "success"
        ? Haptics.NotificationFeedbackType.Success
        : type === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    ),
  selection: () => Haptics.selectionAsync(),
};
