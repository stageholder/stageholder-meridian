// apps/mobile/components/create-fab.tsx
//
// Native mirror of the PWA's CreateFab (apps/pwa/src/components/shared/
// create-fab.tsx): the kit `FAB`, bottom-right, lifted above the floating
// BottomNav capsule, optionally tinted in a feature color so the create
// affordance keeps its per-feature identity (the PWA uses the `--ring-*` CSS
// vars; native passes the resolved IGNITION hex — vars don't resolve in RN
// style objects).
//
// Positioning: the kit FAB is "purely a styled button — it does NOT manage its
// own positioning" (kit docs); its `placement` shorthand injects a hardcoded
// right:24/bottom:24 that the kit spreads AFTER consumer props, fighting any
// r/b override. So we wrap it in an absolutely-positioned View and own the
// offsets ourselves — exactly what the PWA does.

import { FAB, View } from "@stageholder/ui";
import { Plus } from "@tamagui/lucide-icons-2";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";

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
    <View
      position="absolute"
      // Tight to the right edge — the old `placement` shorthand forced ~24px.
      r={12}
      // Sit a comfortable gap ABOVE the floating nav: the content-clearance
      // constant (capsule + breathing) PLUS a small lift, matching the PWA's
      // 6rem (96px) offset. `- 12` earlier put it too close to the capsule.
      // Home-indicator inset added on top so it never double-counts.
      b={BOTTOM_NAV_CLEARANCE + 8 + insets.bottom}
    >
      <FAB
        icon={<Plus size={24} color={iconColor as never} />}
        onPress={onPress}
        aria-label={label}
        {...(tint ? { style: { backgroundColor: tint } } : {})}
      />
    </View>
  );
}
