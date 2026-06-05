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
      icon={<Plus size={24} color={iconColor} />}
      placement="bottom-right"
      r={20}
      // 6rem above the bottom (clears the ~66px capsule + its 12px lift),
      // plus the home-indicator inset — same arithmetic as the PWA's
      // `bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]`.
      b={96 + insets.bottom}
      onPress={onPress}
      aria-label={label}
      {...(tint ? { style: { backgroundColor: tint } } : {})}
    />
  );
}
