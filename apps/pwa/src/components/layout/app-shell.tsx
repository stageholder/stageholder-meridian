import { useCallback, useEffect, useState, useMemo } from "react";
import {
  useCanGoBack,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Search,
  Keyboard,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
} from "@tamagui/lucide-icons-2";
import { isDesktop } from "@repo/core/platform";
import { openURL } from "@repo/core/platform/linking";
import { subscribeLogout } from "@/lib/auth-broadcast";
import { useUserLight } from "@/lib/api/light";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { JourneyTierBadge } from "@/components/layout/journey-tier-badge";
import { navItems, isNavActive } from "@/components/layout/nav-items";
import { useUserMenuItems } from "@/components/layout/use-user-menu";
import { UpdateChecker } from "@/components/shared/update-checker";
import { DailyTargetRings } from "@/components/shared/daily-target-rings";
import { FeedbackButton } from "@/components/shared/feedback-button";
import { CommandPalette } from "@/components/shared/command-palette";
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog";
import { MeridianLogo } from "@/components/shared/meridian-logo";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useUser } from "@/hooks/use-user";
import { LocalUserButton } from "@/components/layout/local-user-button";

import { TrialPill } from "@/components/billing/trial-pill";
import {
  Button,
  Header,
  IconButton,
  MacTrafficLightSpacer,
  Sidebar,
  Text,
  View,
  XStack,
  useSidebar,
} from "@stageholder/ui";

/**
 * Keyboard-shortcut keycap for the sidebar nav trailing slot. A quiet filled
 * chip (muted bg, no border) so it hints rather than competes with the label;
 * the fixed min-width keeps the G / → / key trio aligned down the column.
 */
function ShortcutKeycap({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontFamily="$mono"
      fontSize={10}
      fontWeight="500"
      lineHeight={16}
      color="$mutedForeground"
      bg="$muted"
      rounded="$2"
      px={5}
      minW={18}
      text="center"
    >
      {children}
    </Text>
  );
}

/** The "G → X" two-key chord shown on the right of each nav row. */
function NavShortcut({ shortcutKey }: { shortcutKey: string }) {
  return (
    <XStack items="center" gap={4}>
      <ShortcutKeycap>G</ShortcutKeycap>
      <Text fontSize={10} color="$mutedForeground" opacity={0.5}>
        →
      </Text>
      <ShortcutKeycap>{shortcutKey}</ShortcutKeycap>
    </XStack>
  );
}

/**
 * Outer shell: owns the Sidebar.Provider so every child component (including
 * the inner body, the nav items, the footer FeedbackButton) can call
 * `useSidebar()` to read state and close the mobile drawer on navigation.
 *
 * `collapsedWidth={80}` keeps the macOS traffic-light cluster (~76 px per
 * Apple HIG) inside the collapsed rail when the user runs the desktop Tauri
 * build — paired with `<MacTrafficLightSpacer />` in `<Sidebar.Header>`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <View height={"100dvh" as never} overflow="hidden">
      <Sidebar.Provider defaultOpen height="100%">
        <AppShellBody>{children}</AppShellBody>
      </Sidebar.Provider>
    </View>
  );
}

function AppShellBody({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useUser();
  const { isMobile, setOpenMobile } = useSidebar();
  // Account/user menu — shared with the mobile bottom-nav Profile sheet so the
  // two never drift (see use-user-menu.ts).
  const menuItems = useUserMenuItems();

  const { data: userLight } = useUserLight();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [createTodoDialogOpen, setCreateTodoDialogOpen] = useState(false);

  const shortcutCallbacks = useMemo(
    () => ({
      setCommandPaletteOpen,
      setShortcutsDialogOpen,
      setCreateTodoDialogOpen,
    }),
    [],
  );
  useGlobalShortcuts(shortcutCallbacks);

  // Browser-style nav for desktop. `useCanGoBack` reflects the router's
  // internal history pointer; forward is always enabled because the
  // HTML5 History API doesn't expose a canGoForward signal — clicking
  // when there's nothing forward is a no-op.
  const canGoBack = useCanGoBack();

  // Listen for sign-outs from other tabs — hard-navigate so the new page load
  // runs through the auth proxy and the user lands on /auth/login cleanly.
  useEffect(() => {
    return subscribeLogout(() => {
      openURL(isDesktop() ? "/" : "/auth/login");
    });
  }, []);

  // Imperative nav for sidebar menu rows. asChild support on
  // Sidebar.MenuButton isn't shipped yet in the kit; once it lands we can
  // swap to `<MenuButton asChild><Link to=...>` to preserve middle-click +
  // router prefetch. Closing the mobile drawer on nav keeps the touch UX
  // matching app standards.
  const handleNavigate = useCallback(
    (href: string) => {
      if (isMobile) setOpenMobile(false);
      void navigate({ to: href });
    },
    [isMobile, setOpenMobile, navigate],
  );

  const currentPage = navItems.find((item) => isNavActive(pathname, item.href));

  // The /_app route's `beforeLoad` gate already redirects unauthenticated
  // users and users who haven't completed onboarding, so by the time the
  // shell renders we know the user is signed in. If user is briefly null
  // during a refetch, render nothing to avoid a flash of broken chrome.
  if (!user) return null;

  return (
    <>
      <UpdateChecker />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onOpenShortcuts={() => setShortcutsDialogOpen(true)}
        onCreateTodo={() => setCreateTodoDialogOpen(true)}
      />
      <ShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
      <CreateTodoDialog
        open={createTodoDialogOpen}
        onOpenChange={setCreateTodoDialogOpen}
      />

      {/* Desktop rail only — deliberately NOT mounted on mobile so the
          off-canvas drawer is genuinely unreachable there (not merely
          trigger-hidden): the kit Provider's global Cmd/Ctrl+B then has no
          drawer to open. `isMobile` is the kit's SSR-safe signal (defaults to
          desktop pre-hydration), so the rail never flashes in. */}
      {!isMobile && (
        <Sidebar collapsible="icon" collapsedWidth={80}>
          <Sidebar.Header>
            {/* macOS Tauri traffic-light clearance. Renders 28 px of draggable
              space on Tauri-macOS, null everywhere else. */}
            <MacTrafficLightSpacer />
          </Sidebar.Header>

          <Sidebar.Content>
            {/* Refined product-sidebar nav (Linear/Vercel density): the kit Menu
              gets horizontal padding so the active/hover pill floats inset off
              the rail edges — the old full-bleed highlight read as "no padding
              x". Rows are 40px with a 14px medium label (passed as a custom
              <Text> child because the kit's plain-string label caps at 13px) +
              an 18px icon, on a tight 4px row rhythm. The kit still owns the row
              frame, icon + trailing slots, press/hover/active-bg, and the
              icon-rail collapse. */}
            <Sidebar.Menu px="$2" gap={4}>
              {navItems.map((item) => {
                const isActive = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Sidebar.MenuItem key={item.href}>
                    <Sidebar.MenuButton
                      icon={<Icon size={18} />}
                      isActive={isActive}
                      height={40}
                      rounded="$3"
                      gap="$2.5"
                      trailing={<NavShortcut shortcutKey={item.shortcutKey} />}
                      onPress={() => handleNavigate(item.href)}
                    >
                      <Text
                        flex={1}
                        fontSize={14}
                        fontWeight={isActive ? "600" : "500"}
                        color="$sidebarForeground"
                        numberOfLines={1}
                        text="left"
                      >
                        {item.label}
                      </Text>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                );
              })}
            </Sidebar.Menu>
          </Sidebar.Content>

          <Sidebar.Footer>
            {/* Footer rows mirror the nav rows (inset pills, 40px, 14px label,
              18px icon) so the rail reads as one cohesive system. */}
            <Sidebar.Menu px="$2" gap={4}>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  icon={<Keyboard size={18} />}
                  onPress={() => setShortcutsDialogOpen(true)}
                  height={40}
                  rounded="$3"
                  gap="$2.5"
                  trailing={<ShortcutKeycap>?</ShortcutKeycap>}
                >
                  <Text
                    flex={1}
                    fontSize={14}
                    fontWeight="500"
                    color="$sidebarForeground"
                    numberOfLines={1}
                    text="left"
                  >
                    Shortcuts
                  </Text>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <FeedbackButton />
              </Sidebar.MenuItem>
            </Sidebar.Menu>
            {/* Brand sits at the very bottom of the sidebar. */}
            <SidebarBrand />
          </Sidebar.Footer>
        </Sidebar>
      )}

      <Sidebar.Inset>
        {/* Top bar — kit <Header> owns the chrome (height, bg, border,
            sticky position, translucent backdrop-blur, justify/gap/px).
            `safeAreaInset` adds the notch / Dynamic Island top inset to the
            header region only (no-op on desktop) — scoped here instead of on the
            whole shell so the mobile drawer isn't pushed down. `tauriDragRegion`
            forwards data-tauri-drag-region so macOS users drag the window by the
            bar. */}
        <Header bordered safeAreaInset tauriDragRegion>
          {/* LEFT group — sidebar toggle + browser-style nav + page title. */}
          <XStack items="center" gap="$2" shrink={0}>
            {/* Sidebar toggle — desktop only (collapses the rail). Hidden on
                mobile: the off-canvas drawer is intentionally unreachable there,
                so the floating BottomNav is the sole mobile navigation. */}
            <View display="none" $md={{ display: "flex" }}>
              <Sidebar.Trigger aria-label="Toggle navigation">
                <PanelLeft size={16} />
              </Sidebar.Trigger>
            </View>

            {/* Mobile only — the Dashboard ("/") isn't a bottom-nav destination,
                so the brand mark doubles as the home affordance. Desktop reaches
                home via the sidebar brand instead. */}
            <Header.Logo
              onPress={() => void navigate({ to: "/" })}
              $md={{ display: "none" }}
            >
              <MeridianLogo size="sm" />
            </Header.Logo>

            {/* Browser-style nav, desktop only. Forward is always enabled —
                HTML5 history has no canGoForward signal; clicking when
                there's no forward entry is a no-op. */}
            {isDesktop() && (
              <XStack
                items="center"
                gap={2}
                display="none"
                $md={{ display: "flex" }}
              >
                <IconButton
                  variant="ghost"
                  size="sm"
                  disabled={!canGoBack}
                  onPress={() => window.history.back()}
                  aria-label="Back"
                  title="Back (⌘[)"
                >
                  <ChevronLeft size={16} />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onPress={() => window.history.forward()}
                  aria-label="Forward"
                  title="Forward (⌘])"
                >
                  <ChevronRight size={16} />
                </IconButton>
                <View width={1} height={16} bg="$borderColor" mx="$1" />
              </XStack>
            )}

            {/* Page title. The muted color goes ON the icon (a v2
                @tamagui/lucide-icons-2 component resolves the token) rather than
                cascading from the XStack — v2 themed icons read their own
                `color`, not inherited CSS, and `color` isn't a valid Stack prop. */}
            {currentPage && (
              <XStack items="center" gap="$2">
                <currentPage.icon size={16} color="$mutedForeground" />
                <Text
                  fontSize="$3"
                  fontWeight="500"
                  color="$color"
                  display="none"
                  $sm={{ display: "block" }}
                >
                  {currentPage.label}
                </Text>
              </XStack>
            )}
          </XStack>

          {/* CENTER — search trigger. A plain flex-1 stack (no maxWidth cap)
              absorbs the free space and centers the search; the kit Center's
              560px cap left dangling space that collapsed the actions cluster. */}
          <XStack flex={1} minW={0} items="center" justify="center">
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setCommandPaletteOpen(true)}
              gap="$2"
              display="none"
              $sm={{ display: "flex" }}
              // Muted tint set on the v2 icon directly (it reads its own color,
              // not the Button's) — `color` isn't a valid Button prop anyway.
              icon={<Search size={14} color="$mutedForeground" />}
            >
              <Text fontSize="$1" color="$mutedForeground">
                Search...
              </Text>
              <Text
                ml="$1"
                px="$1.5"
                fontFamily="$mono"
                fontSize={10}
                fontWeight="500"
                color="$mutedForeground"
                bg="$muted"
                rounded="$sm"
                borderWidth={1}
                borderColor="$borderColor"
                pointerEvents="none"
                display="none"
                $sm={{ display: "inline-flex" }}
              >
                ⌘K
              </Text>
            </Button>
          </XStack>

          {/* RIGHT side actions. shrink={0} keeps the cluster at its content
              width; overflow="hidden" clips the journey tier-ring's decorative
              glow (an absolute element that bled ~89px past the viewport edge)
              — without collapsing the cluster, since shrink={0} fixes its
              width. Popover/menu dropdowns are portalled, so they're unaffected. */}
          <Header.Actions shrink={0} overflow="hidden">
            {/* Decorative — desktop only so the essentials (trial /
                user menu) always fit and never clip on narrow widths. */}
            <XStack
              items="center"
              gap="$1.5"
              display="none"
              $md={{ display: "flex" }}
            >
              <DailyTargetRings />
              <View width={1} height={16} bg="$borderColor" mx="$1" />
            </XStack>
            <TrialPill />

            {/* Journey / tier progress. Renders a compact ring (mobile) or
                the full title + popover (desktop), gated internally by media
                props — see journey-tier-badge.tsx. */}
            {userLight && <JourneyTierBadge userLight={userLight} />}

            {/* User menu — local replacement for the SDK's UserButton (BFF-only
                under SPA). DESKTOP ONLY: on mobile the same account menu is
                reached via the bottom-nav Profile item, so the header avatar
                would be redundant. Items come from the shared useUserMenuItems
                hook (also used by the mobile Profile sheet) so the two stay in
                lockstep. hideSignOut is a no-op — sign-out is a menu item. */}
            <View display="none" $md={{ display: "flex" }}>
              <LocalUserButton hideSignOut menuItems={menuItems} />
            </View>
          </Header.Actions>
        </Header>

        {/* Page content */}
        <View
          render="main"
          flex={1}
          overflowY={"auto" as never}
          overflowX={"hidden" as never}
          // Clearance for the floating BottomNav capsule (mobile only). The
          // capsule (~66px) sits ~12px above the bottom edge, so the content's
          // last rows need ≈5.5rem + the home-indicator inset to clear it. The
          // safe-area inset lives ONLY here (the kit owns the capsule's own
          // offset), so it isn't double-counted. Removed at md+ where the rail
          // replaces the bottom nav.
          // allowlist: env safe-area inset on the bottom padding (no token equivalent)
          className="pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
          $md={{ pb: 0 }}
        >
          {children}
        </View>

        {/* Mobile bottom navigation */}
        <MobileBottomNav />
      </Sidebar.Inset>
    </>
  );
}

/**
 * Brand block for the sidebar header. Hides the wordmark when the rail is
 * iconified so the logo stays centered in the collapsed (80 px) column.
 */
function SidebarBrand() {
  const { state, collapsible, isMobile } = useSidebar();
  const iconified =
    !isMobile && state === "collapsed" && collapsible === "icon";
  return (
    <XStack
      width="100%"
      items="center"
      gap="$2"
      rounded="$md"
      p="$2"
      justify={iconified ? "center" : undefined}
    >
      <MeridianLogo size="md" />
      {!iconified && (
        <Text
          flex={1}
          fontSize="$6"
          fontWeight="600"
          color="$sidebarForeground"
          numberOfLines={1}
        >
          Meridian
        </Text>
      )}
    </XStack>
  );
}
