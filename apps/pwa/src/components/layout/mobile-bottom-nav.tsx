import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BottomNav, DropdownMenu, Text, View } from "@stageholder/ui";
import { bottomNavItems, isNavActive } from "@/components/layout/nav-items";
import {
  useUserMenuItems,
  getUserInitials,
} from "@/components/layout/use-user-menu";
import { UserMenuContent } from "@/components/layout/local-user-button";
import { useUser } from "@/hooks/use-user";

// Sentinel value for the Profile item — NOT a route, so `onChange` opens the
// account menu instead of navigating, and it never matches `activeValue` (so
// Profile never shows the active indicator).
const PROFILE_VALUE = "__profile__";

/** Mini avatar (image or initials) rendered as the Profile nav item's icon —
 *  sized to the kit's 22px icon box. Leaf `<img>` per MeridianLogo's rationale
 *  (the kit Avatar.Image is RN / `source`-shaped). */
function ProfileNavAvatar() {
  const { user } = useUser();
  const src = user?.avatar ?? user?.picture;
  const initials = getUserInitials(user?.name, user?.email);
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
        <img
          src={src}
          alt=""
          width={22}
          height={22}
          style={{ objectFit: "cover", display: "block" }}
        />
      ) : (
        <Text fontSize={9} fontWeight="700" color="$color" lineHeight={11}>
          {initials}
        </Text>
      )}
    </View>
  );
}

/**
 * Mobile primary navigation — the kit's floating `BottomNav` (the WhatsApp/Arc
 * "detached capsule" variant). Shown only below md (768px); the desktop Sidebar
 * rail takes over at md+.
 *
 * The kit owns the capsule shape, the sliding active indicator, the internal
 * iOS-home-indicator safe-area padding, and the press-scale + haptic feedback.
 * We supply only the viewport anchoring and the responsive gate on the OUTER
 * wrapper — a static `$md` media prop (compiler-extracted to a CSS media query),
 * never a JS `useMedia` branch, per the Tamagui v2 guideline that pure layout
 * toggles stay declarative.
 *
 * Destinations come from the shared `bottomNavItems` list (see `nav-items.ts`)
 * so they can never drift from the sidebar. The trailing Profile item carries
 * the user's avatar and opens the SAME account menu as the desktop header — the
 * kit `DropdownMenu`, which on mobile auto-adapts to its own styled bottom Sheet
 * (Adapt → Sheet). No custom sheet.
 */
export function MobileBottomNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profileOpen, setProfileOpen] = useState(false);
  const menuItems = useUserMenuItems();

  // Match by longest route prefix so nested routes (e.g. /journal/$id) keep
  // their tab active. Empty string when the current route isn't a bottom-nav
  // destination (e.g. the dashboard "/"), so no item is falsely highlighted.
  const activeValue =
    bottomNavItems.find((item) => isNavActive(pathname, item.href))?.href ?? "";

  return (
    <>
      <View
        // Bottom-pinned positioning layer. It spans the full width (to center
        // the pill) but is pointerEvents="none", so it never intercepts taps —
        // only the centered capsule below re-enables them. Taps in the side
        // gutters and the strip beneath the pill therefore fall through to the
        // page content scrolling underneath. (Manual "box-none": Tamagui maps
        // RN's box-none to a plain pointer-events:none WITHOUT re-enabling
        // children — see @tamagui/web getCSSStylesAtomic — so the correct
        // pattern is none-on-layer + auto-on-pill, NOT box-none, which would
        // disable taps on the whole nav.)
        // Tamagui's position type omits the web "fixed" value; cast as the kit does.
        position={"fixed" as never}
        b={0}
        l={0}
        r={0}
        z={40}
        items="center"
        pointerEvents="none"
        // Mobile-only: the desktop Sidebar rail replaces the bottom nav at md+.
        $md={{ display: "none" }}
      >
        <BottomNav
          variant="floating"
          value={activeValue}
          onChange={(v) => {
            // Profile isn't a route — it opens the account menu.
            if (v === PROFILE_VALUE) {
              setProfileOpen(true);
              return;
            }
            void navigate({ to: v });
          }}
          // `width="auto"` makes the capsule hug its items so the bar doesn't
          // span the full width (no gutter dead-zones); `pointerEvents="auto"`
          // re-enables taps on the pill despite the layer's "none". Both are
          // forwarded onto the kit's floating wrapper via its `...rest`.
          width="auto"
          pointerEvents="auto"
          label="Primary navigation"
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <BottomNav.Item
                key={item.href}
                value={item.href}
                // The kit auto-sizes (22px) and tints the icon by active state.
                icon={<Icon />}
                label={item.label}
              />
            );
          })}
          {/* Profile — the user's avatar; opens the account menu (the avatar
              ignores the kit's active tint). */}
          <BottomNav.Item
            value={PROFILE_VALUE}
            icon={<ProfileNavAvatar />}
            label="Profile"
          />
        </BottomNav>
      </View>

      {/* Profile menu — the SAME kit DropdownMenu the desktop header uses
          (shared UserMenuContent + useUserMenuItems), controlled by the Profile
          tap. On mobile the kit auto-adapts it to its own styled bottom Sheet
          (Adapt → Sheet at max-md), so this is the kit's default action sheet,
          not a hand-rolled one. No trigger: the bottom-nav item owns the open
          state, and this menu only renders on mobile (the nav is $md-hidden),
          where it's always the sheet — so no popover anchor is needed. */}
      <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
        <DropdownMenu.Content
          {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as object)}
        >
          {/* Close the sheet after navigating / signing out (the kit's plain
              menu rows don't auto-dismiss). The dark-mode toggle deliberately
              keeps it open so the theme change is visible. */}
          <UserMenuContent
            menuItems={menuItems}
            onAfterSelect={() => setProfileOpen(false)}
          />
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  );
}
