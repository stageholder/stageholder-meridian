import { useCallback, useEffect, useState, useMemo } from "react";
import {
  useCanGoBack,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Target,
  Settings,
  LogOut,
  Search,
  Keyboard,
  CreditCard,
  UserCog,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  PanelLeft,
  Moon,
} from "lucide-react";
import { useAppTheme } from "@/lib/platform/theme";
import { isDesktop } from "@repo/core/platform";
import { openURL } from "@repo/core/platform/linking";
import { syncAll } from "@/lib/offline";
import { subscribeLogout } from "@/lib/auth-broadcast";
import { useUserLight } from "@/lib/api/light";
import { StarVisual } from "@/components/light/star-visual";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import {
  getTierProgress,
  getNextTier,
  LIGHT_TIERS,
} from "@repo/core/types/light";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import { SyncConflictListener } from "@/components/shared/sync-conflict-toast";
import { UpdateChecker } from "@/components/shared/update-checker";
import { DailyTargetRings } from "@/components/shared/daily-target-rings";
import { FeedbackButton } from "@/components/shared/feedback-button";
import { CommandPalette } from "@/components/shared/command-palette";
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog";
import { MeridianLogo } from "@/components/shared/meridian-logo";
import { useUpdateStore } from "@/lib/update-store";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useUser } from "@/hooks/use-user";
import { useStageholder } from "@stageholder/sdk/spa";
import { LocalUserButton } from "@/components/layout/local-user-button";

import { TrialPill } from "@/components/billing/trial-pill";
import {
  Button,
  Header,
  IconButton,
  MacTrafficLightSpacer,
  Popover,
  Progress,
  ProgressRing,
  Sidebar,
  Text,
  View,
  XStack,
  YStack,
  useSidebar,
} from "@stageholder/ui";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home, shortcutKey: "D" },
  {
    href: "/calendar",
    label: "Today",
    icon: CalendarDays,
    shortcutKey: "C",
  },
  { href: "/todos", label: "Todos", icon: CheckSquare, shortcutKey: "T" },
  { href: "/habits", label: "Habits", icon: Target, shortcutKey: "H" },
  { href: "/journal", label: "Journal", icon: BookOpen, shortcutKey: "J" },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    shortcutKey: "S",
  },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
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
    // allowlist: safe-area-top env inset (no token equivalent)
    <View
      height={"100dvh" as never}
      overflow="hidden"
      className="safe-area-top"
    >
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
  const { signOut } = useStageholder();
  const { isMobile, setOpenMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  // One-shot sync on mount. No interval polling, no focus refetch, no
  // /health heartbeat — mutations already invalidate their own caches,
  // and the rest stays hydrated from Dexie until the user explicitly
  // refreshes.
  useEffect(() => {
    void syncAll();
  }, []);

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

  async function handleLogout() {
    // SDK signOut runs the SPA logout flow (revokes tokens, clears storage,
    // hits the Hub's end-session endpoint, and lands on /goodbye). The
    // /goodbye route owns the cross-tab broadcast — broadcasting here
    // would race the Hub session and peer tabs could silent-SSO back in.
    await signOut();
  }

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
      <SyncConflictListener />
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

      <Sidebar collapsible="icon" collapsedWidth={80}>
        <Sidebar.Header>
          {/* macOS Tauri traffic-light clearance. Renders 28 px of draggable
              space on Tauri-macOS, null everywhere else. */}
          <MacTrafficLightSpacer />
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Menu>
            {navItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Sidebar.MenuItem key={item.href}>
                  <Sidebar.MenuButton
                    icon={<Icon size={16} />}
                    isActive={isActive}
                    trailing={
                      <XStack items="center" gap="$1">
                        <Text
                          fontFamily="$mono"
                          fontSize={10}
                          fontWeight="500"
                          color="$mutedForeground"
                          px="$1"
                          rounded="$sm"
                          borderWidth={1}
                          borderColor="$sidebarBorder"
                        >
                          G
                        </Text>
                        <Text fontSize={9} color="$mutedForeground">
                          →
                        </Text>
                        <Text
                          fontFamily="$mono"
                          fontSize={10}
                          fontWeight="500"
                          color="$mutedForeground"
                          px="$1"
                          rounded="$sm"
                          borderWidth={1}
                          borderColor="$sidebarBorder"
                        >
                          {item.shortcutKey}
                        </Text>
                      </XStack>
                    }
                    onPress={() => handleNavigate(item.href)}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              );
            })}
          </Sidebar.Menu>
        </Sidebar.Content>

        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                icon={<Keyboard size={16} />}
                onPress={() => setShortcutsDialogOpen(true)}
                trailing={
                  <Text
                    fontFamily="$mono"
                    fontSize={10}
                    fontWeight="500"
                    color="$mutedForeground"
                    px="$1"
                    rounded="$sm"
                    borderWidth={1}
                    borderColor="$sidebarBorder"
                  >
                    ?
                  </Text>
                }
              >
                Shortcuts
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

      <Sidebar.Inset>
        {/* Top bar — kit <Header> owns the chrome (height, bg, border,
            sticky position, translucent backdrop-blur, justify/gap/px).
            The kit Header doesn't expose a tauri-drag prop, so we keep the
            data-tauri-drag-region attribute via Tamagui's prop forwarding —
            same pattern <MacTrafficLightSpacer /> uses — to preserve macOS
            window dragging from the bar. */}
        <Header bordered {...({ "data-tauri-drag-region": "" } as object)}>
          {/* LEFT group — sidebar toggle + browser-style nav + page title. */}
          <XStack items="center" gap="$2" shrink={0}>
            {/* Sidebar toggle — collapses the desktop rail / opens the mobile
                drawer. Replaces the previous custom mobile-only Drawer wrapper. */}
            <Sidebar.Trigger aria-label="Toggle navigation">
              <PanelLeft size={16} />
            </Sidebar.Trigger>

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

            {/* Page title */}
            {currentPage && (
              <XStack items="center" gap="$2" color="$mutedForeground">
                <currentPage.icon size={16} />
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
              color="$mutedForeground"
              display="none"
              $sm={{ display: "flex" }}
              icon={<Search size={14} />}
            >
              <Text fontSize="$1">Search...</Text>
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
            {/* Decorative — desktop only so the essentials (offline / trial /
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
            <OfflineIndicator />
            <TrialPill />

            {/* Journey / tier progress (desktop only). shrink={0} on the
                wrapper AND on the trigger keeps the control at its content
                width so it never collapses under the flex row's shrink
                pressure. */}
            <XStack
              items="center"
              shrink={0}
              display="none"
              $md={{ display: "flex" }}
            >
              {userLight &&
                (() => {
                  const progress = getTierProgress(
                    userLight.totalLight,
                    userLight.currentTier,
                  );
                  const nextTier = getNextTier(userLight.currentTier);
                  // COLOR VALUES per tier. `ring` is the brightest mid-stop —
                  // applied as a SOLID color via Tamagui's `color`/`fillColor`
                  // props (no gradient text clip). `track` is the unfilled ring.
                  const tierColors: Record<
                    number,
                    { ring: string; track: string }
                  > = {
                    1: { ring: "#cbd5e1", track: "rgba(148,163,184,0.15)" },
                    2: { ring: "#ef4444", track: "rgba(239,68,68,0.15)" },
                    3: { ring: "#f59e0b", track: "rgba(245,158,11,0.15)" },
                    4: { ring: "#f97316", track: "rgba(249,115,22,0.15)" },
                    5: { ring: "#f97316", track: "rgba(249,115,22,0.15)" },
                    6: { ring: "#eab308", track: "rgba(234,179,8,0.15)" },
                    7: { ring: "#fbbf24", track: "rgba(251,191,36,0.15)" },
                    8: { ring: "#fde68a", track: "rgba(253,230,138,0.15)" },
                    9: { ring: "#eab308", track: "rgba(234,179,8,0.15)" },
                    10: { ring: "#fbbf24", track: "rgba(251,191,36,0.15)" },
                  };
                  const colors = (tierColors[userLight.currentTier] ??
                    tierColors[1])!;
                  return (
                    <Popover placement="bottom-end">
                      <Popover.Trigger asChild>
                        <Button
                          intent="ghost"
                          size="sm"
                          shrink={0}
                          gap={6}
                          py="$1"
                          px="$2"
                          height="auto"
                          aria-label="Journey progress"
                        >
                          <Text
                            fontSize={11}
                            fontWeight="600"
                            letterSpacing={0.5}
                            color={colors.ring}
                          >
                            {userLight.currentTitle}
                          </Text>
                          <ProgressRing
                            value={progress}
                            size={28}
                            thickness={2.5}
                            fillColor={colors.ring}
                            trackColor={colors.track}
                            shrink={0}
                          >
                            <StarVisual
                              tier={userLight.currentTier}
                              size="xs"
                            />
                          </ProgressRing>
                        </Button>
                      </Popover.Trigger>
                      <Popover.Content
                        width={256}
                        maxW="calc(100vw - 2rem)"
                        p={0}
                      >
                        <YStack items="center" gap="$2" px="$4" pt="$4" pb="$3">
                          <ProgressRing
                            value={progress}
                            size={72}
                            thickness={4}
                            fillColor={colors.ring}
                            trackColor={colors.track}
                            animate
                          >
                            <StarVisual
                              tier={userLight.currentTier}
                              size="md"
                              animate
                            />
                          </ProgressRing>
                          <Text fontSize="$3" fontWeight="700">
                            {userLight.currentTitle}
                          </Text>
                          <Text
                            fontSize={11}
                            color="$mutedForeground"
                            text="center"
                            lineHeight={15}
                            px="$1"
                          >
                            {
                              LIGHT_TIERS[userLight.currentTier - 1]
                                ?.shortDescription
                            }
                          </Text>
                          {nextTier ? (
                            <YStack width="100%" gap="$0.5">
                              <Progress
                                value={progress}
                                height={6}
                                width="100%"
                                bg="$muted"
                                rounded={9999}
                              >
                                <Progress.Indicator
                                  bg="$warning"
                                  transition="quick"
                                />
                              </Progress>
                              <Text
                                text="center"
                                fontSize={11}
                                color="$mutedForeground"
                              >
                                <Text fontWeight="500" color="$color">
                                  {userLight.totalLight}
                                </Text>
                                {" / "}
                                {nextTier.lightRequired} Light
                              </Text>
                            </YStack>
                          ) : (
                            <Text fontSize={11} color="$mutedForeground">
                              {userLight.totalLight.toLocaleString()} Light —
                              Max tier reached
                            </Text>
                          )}
                        </YStack>
                        <XStack
                          width="100%"
                          py="$2.5"
                          borderTopWidth={1}
                          borderColor="$borderColor"
                        >
                          <YStack flex={1} items="center" gap="$0.5">
                            <Text fontSize="$1" fontWeight="700">
                              {userLight.perfectDayStreak}d
                            </Text>
                            <Text fontSize={10} color="$mutedForeground">
                              Streak
                            </Text>
                          </YStack>
                          <YStack flex={1} items="center" gap="$0.5">
                            <Text fontSize="$1" fontWeight="700">
                              {userLight.perfectDaysTotal}
                            </Text>
                            <Text fontSize={10} color="$mutedForeground">
                              Perfect
                            </Text>
                          </YStack>
                          <YStack flex={1} items="center" gap="$0.5">
                            <Text fontSize="$1" fontWeight="700">
                              {userLight.longestPerfectStreak}d
                            </Text>
                            <Text fontSize={10} color="$mutedForeground">
                              Best
                            </Text>
                          </YStack>
                        </XStack>
                        {/* Popover.Close dismisses the popover on click; the
                          Button's onPress still navigates (handlers compose). */}
                        <Popover.Close asChild>
                          <Button
                            intent="ghost"
                            size="sm"
                            width="100%"
                            height="auto"
                            py="$2.5"
                            rounded={0}
                            borderTopWidth={1}
                            borderColor="$borderColor"
                            color="$mutedForeground"
                            hoverStyle={{ bg: "$accent", color: "$color" }}
                            onPress={() => navigate({ to: "/journey" })}
                          >
                            My Journey →
                          </Button>
                        </Popover.Close>
                      </Popover.Content>
                    </Popover>
                  );
                })()}
            </XStack>

            {/* User menu — local replacement for the SDK's UserButton
                (which is BFF-only / unreachable under SPA). Same menu
                contract; sign-out always routes through our handleLogout
                so any future desktop branch is preserved. The theme
                switcher lives inside this menu instead of as a separate
                header icon — fewer header elements competing for
                attention, and theme preference is a per-account setting
                anyway. */}
            <LocalUserButton
              hideSignOut
              menuItems={[
                {
                  // Profile editing lives in-app via the SDK's
                  // <ProfileSettings>. Security operations (password,
                  // MFA, sessions, account deletion) still live on Hub
                  // and are reachable from /settings → Account tab.
                  label: "Account settings",
                  href: "/settings",
                  icon: <UserCog size={16} />,
                },
                {
                  // Single billing entry — matches every major SaaS
                  // (Notion, Linear, Stripe, Vercel, GitHub, Slack: one
                  // item that navigates to the billing page). The dialog
                  // stays in the codebase but only fires CONTEXTUALLY
                  // when a user hits a feature limit — not from menu nav.
                  label: "Plans & billing",
                  href: "/settings/billing",
                  icon: <CreditCard size={16} />,
                },
                {
                  kind: "switch",
                  label: "Dark mode",
                  value: isDark,
                  onChange: (next) => setTheme(next ? "dark" : "light"),
                  icon: <Moon size={16} />,
                },
                // Manual trigger for the same updater the auto-poll uses
                // (UpdateChecker runs check() on launch + every 30 min
                // silently). Desktop-only — the updater plugin isn't
                // available on web.
                ...(isDesktop()
                  ? [
                      {
                        label: "Check for updates",
                        onSelect: () =>
                          useUpdateStore
                            .getState()
                            .requestCheck({ showWhenUpToDate: true }),
                        icon: <RefreshCw size={16} />,
                      },
                    ]
                  : []),
                {
                  label: "Sign out",
                  onSelect: () => void handleLogout(),
                  icon: <LogOut size={16} />,
                },
              ]}
            />
            {/* hideSignOut is accepted for API parity but is a no-op —
                LocalUserButton never renders a built-in sign-out. */}
          </Header.Actions>
        </Header>

        {/* Page content */}
        <View
          tag="main"
          flex={1}
          overflowY={"auto" as never}
          overflowX={"hidden" as never}
          // allowlist: env safe-area inset on the bottom padding (no token equivalent)
          className="pb-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]"
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
