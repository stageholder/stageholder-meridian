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
// order — plus the trailing Profile avatar item. Profile is NOT a route
// (PWA parity): tapping it opens the account bottom sheet (ProfileSheet —
// user header, Account settings, Plans & billing, Dark mode, Sign out),
// exactly like the PWA's Profile tap opens its adapted DropdownMenu sheet.
// The sentinel value never matches `activeValue`, so Profile never takes
// the active pill — Settings is reached THROUGH the sheet.
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
import { useState } from "react";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileSheet } from "@/components/profile-sheet";

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

// Sentinel value for the Profile item — NOT a route, so `onChange` opens the
// account sheet instead of navigating, and it never matches `activeValue`
// (so Profile never shows the active indicator). Same as the PWA's.
const PROFILE_VALUE = "__profile__";

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
  const [profileOpen, setProfileOpen] = useState(false);

  // Active tab — nested detail routes (journal/[id]) highlight their parent
  // destination, mirroring the PWA's longest-prefix isNavActive.
  const currentName = state.routes[state.index]?.name ?? "";
  const activeValue = currentName.split("/")[0] ?? "";

  return (
    <>
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
          onChange={(v) => {
            // Profile isn't a route — it opens the account sheet (PWA parity).
            if (v === PROFILE_VALUE) {
              setProfileOpen(true);
              return;
            }
            navigation.navigate(v);
          }}
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
            value={PROFILE_VALUE}
            icon={<ProfileNavAvatar />}
            label="Profile"
          />
        </BottomNav>
      </View>

      {/* Account sheet — the PWA's Profile menu as a driven native Sheet
          (user header · Account settings · Plans & billing · Dark mode ·
          Sign out). Modal, so it portals above the tab content. */}
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
