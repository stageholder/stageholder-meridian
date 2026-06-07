// apps/mobile/components/create-fab.tsx
//
// Native mirror of the PWA's CreateFab (apps/pwa/src/components/shared/
// create-fab.tsx): the kit `FAB`, bottom-right, lifted above the floating
// BottomNav capsule with the same 6rem clearance + home-indicator inset, and
// optionally tinted in a feature color so the create affordance keeps its
// per-feature identity (the PWA uses the `--ring-*` CSS vars; native passes
// the resolved IGNITION hex — tokens/vars don't resolve in RN style objects).

import { FAB } from "@stageholder/ui";
import { Plus } from "@tamagui/lucide-icons-2";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function CreateFab({
  onPress,
  label,
  tint,
  iconColor = "#ffffff",
}: {
  onPress: () => void;
  /** Accessible name for the button. */
  label: string;
  /** Resolved feature color hex (e.g. IGNITION.habit.base). Omit for `$primary`. */
  tint?: string;
  iconColor?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <FAB
      icon={<Plus size={24} color={iconColor as never} />}
      placement="bottom-right"
      // Standard Material/iOS edge margin.
      r={16}
      // Just above the floating BottomNav capsule (~64px + 12px lift) with a
      // 16px gap, plus the home-indicator inset — anchored to the nav rather
      // than floating mid-air. (PWA parity arithmetic, tightened.)
      b={92 + insets.bottom}
      onPress={onPress}
      aria-label={label}
      {...(tint ? { style: { backgroundColor: tint } } : {})}
    />
  );
}
