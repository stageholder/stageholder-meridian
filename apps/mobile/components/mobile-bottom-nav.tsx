// apps/mobile/components/mobile-bottom-nav.tsx
//
// Native mirror of the PWA's mobile chrome (apps/pwa/src/components/layout/
// mobile-bottom-nav.tsx): the SAME kit floating `BottomNav` capsule —
// detached, fully-rounded, sliding active pill, press-scale feedback — so the
// two surfaces read as one product. Rendered as the expo-router <Tabs> custom
// `tabBar`, replacing the stock RN tab bar (whose system styling is what made
// native look foreign next to the PWA).
//
// Destinations mirror the PWA's `bottomNavItems` (apps/pwa/src/components/
// layout/nav-items.ts) — Today / Todos / Habits / Journal, same icons, same
// order — plus the trailing Profile avatar item. One deliberate IA
// difference: the PWA's Profile item opens the account MENU (Dashboard via
// the header logo, Settings inside the menu); on mobile the Profile item
// routes to the Settings screen, which holds the same account / theme /
// sign-out actions. Because Settings IS a route here, the Profile item DOES
// take the active pill when you're on it (the PWA's never does — its profile
// is a menu, not a destination).
//
// The wrapper layer is absolute-positioned with `box-none` so the side
// gutters stay scrollable — on NATIVE box-none works as designed (the
// none-on-layer/auto-on-pill workaround in the PWA exists only because
// Tamagui WEB collapses box-none; see the kit migration notes).

import { useUser } from "@stageholder/sdk/react-native";
import { BottomNav, Text, View } from "@stageholder/ui";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Target,
} from "@tamagui/lucide-icons-2";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom padding scroll content needs to clear the floating capsule — the
 * native equivalent of the PWA shell's
 * `pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]`. Screens add
 * `useSafeAreaInsets().bottom` on top at the call site (the inset isn't
 * baked in so it's never double-counted).
 */
export const BOTTOM_NAV_CLEARANCE = 88;

// Same four day-to-day destinations as the PWA's bottomNavItems, same icons
// (CalendarDays/CheckSquare/Target/BookOpen), same order. `name` is the
// expo-router route name inside (authed)/ — "index" is the daily dashboard,
// which plays the PWA's "/calendar Today" role on mobile.
const NAV_ITEMS = [
  { name: "index", label: "Today", icon: CalendarDays },
  { name: "todos", label: "Todos", icon: CheckSquare },
  { name: "habits", label: "Habits", icon: Target },
  { name: "journal", label: "Journal", icon: BookOpen },
] as const;

const PROFILE_ROUTE = "settings";

function getUserInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * 22px avatar (photo or initials) as the Profile item's icon — hand-rolled to
 * the kit BottomNav's fixed icon-box size, same rationale as the PWA's
 * ProfileNavAvatar (the kit Avatar doesn't size down to 22px cleanly).
 */
function ProfileNavAvatar() {
  const { user } = useUser();
  const src = user?.picture ?? undefined;
  return (
    <View
      width={22}
      height={22}
      rounded={999}
      overflow="hidden"
      items="center"
      justify="center"
      bg="$muted"
      borderWidth={1}
      borderColor="$borderColor"
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: 22, height: 22 }} />
      ) : (
        <Text fontSize={9} fontWeight="700" color="$color" lineHeight={11}>
          {getUserInitials(user?.name, user?.email)}
        </Text>
      )}
    </View>
  );
}

// Minimal structural slice of @react-navigation/bottom-tabs'
// BottomTabBarProps — typed locally to avoid a direct dependency on the
// transitive package; expo-router passes the full object.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

export function MobileBottomNav({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  // Active tab — nested detail routes (journal/[id]) highlight their parent
  // destination, mirroring the PWA's longest-prefix isNavActive.
  const currentName = state.routes[state.index]?.name ?? "";
  const activeValue = currentName.split("/")[0] ?? "";

  return (
    <View
      position="absolute"
      // The kit's floating variant owns the capsule's own 12px lift; we add
      // only the home-indicator inset underneath (the PWA's env() inset).
      b={insets.bottom}
      l={0}
      r={0}
      items="center"
      pointerEvents="box-none"
    >
      <BottomNav
        variant="floating"
        value={activeValue}
        onChange={(v) => navigation.navigate(v)}
        // NO `width="auto"` since alpha.31: the kit wrapper owns centering at
        // full width, and with 5 destinations the capsule auto-switches to
        // DENSE mode (equal-flex items on a full-width track) — a hugged
        // wrapper would collapse the dense layout. Same change as the PWA.
        label="Primary navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <BottomNav.Item
              key={item.name}
              value={item.name}
              // The kit auto-sizes (22px) and tints the icon by active state.
              icon={<Icon />}
              label={item.label}
            />
          );
        })}
        <BottomNav.Item
          value={PROFILE_ROUTE}
          icon={<ProfileNavAvatar />}
          label="Profile"
        />
      </BottomNav>
    </View>
  );
}
