// apps/mobile/components/create-fab.tsx
//
// The kit `FAB`, bottom-right, tinted in a feature color so the create
// affordance keeps its per-feature identity.
//
// Positioning: the native tab bar's height can't be measured (expo-router
// NativeTabs limitation), so the FAB rides inside a bottom-edge
// react-native-safe-area-context SafeAreaView. That native view reads the
// screen's REAL UIKit/Android safe area — on iOS inside a UITabBarController
// it includes the tab bar, on Android NativeTabs already lays the screen out
// above the bar — so the button always floats just above the bar, on every
// device, with no magic number. `box-none` keeps the rest of the overlay
// transparent to touches.

import { FAB } from "@stageholder/ui";
import { Plus } from "@tamagui/lucide-icons-2";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function CreateFab({
  onPress,
  label,
  tint,
  iconColor = "#ffffff",
  testID,
}: {
  onPress: () => void;
  /** Accessible name for the button. */
  label: string;
  /** Resolved feature color hex (e.g. IGNITION.habit.base). Omit for `$primary`. */
  tint?: string;
  iconColor?: string;
  testID?: string;
}) {
  return (
    <SafeAreaView
      edges={["bottom"]}
      pointerEvents="box-none"
      style={styles.overlay}
    >
      <View pointerEvents="box-none" style={styles.slot}>
        <FAB
          icon={<Plus size={24} color={iconColor as never} />}
          onPress={onPress}
          aria-label={label}
          testID={testID}
          {...(tint ? { style: { backgroundColor: tint } } : {})}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
  slot: { alignItems: "flex-end", paddingRight: 16, paddingBottom: 16 },
});
