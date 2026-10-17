// apps/mobile/lib/action-sheet.ts
//
// Platform action sheet: the real UIKit action sheet on iOS
// (ActionSheetIOS), a native dialog on Android (Material has no action sheet;
// an Alert with up to three choices is the platform equivalent). Use for
// short lists of actions on one item instead of web-style dropdown menus.

import { ActionSheetIOS, Alert, Platform } from "react-native";

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function showActionSheet({
  title,
  message,
  actions,
}: {
  title?: string;
  message?: string;
  /** Android shows at most three actions; keep lists short. */
  actions: SheetAction[];
}) {
  if (Platform.OS === "ios") {
    const labels = [...actions.map((a) => a.label), "Cancel"];
    const destructiveButtonIndex = actions
      .map((a, i) => (a.destructive ? i : -1))
      .filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex,
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  // Android: a native dialog holds at most three buttons. With ≤2 actions
  // keep an explicit Cancel; with 3, drop Cancel and rely on Back / tapping
  // outside (`cancelable`) — the Material dialog convention.
  const buttons = actions.slice(0, 3).map((a) => ({
    text: a.label,
    style: a.destructive ? ("destructive" as const) : ("default" as const),
    onPress: a.onPress,
  }));
  Alert.alert(
    title ?? "",
    message,
    actions.length <= 2
      ? [{ text: "Cancel", style: "cancel" as const }, ...buttons]
      : buttons,
    { cancelable: true },
  );
}
