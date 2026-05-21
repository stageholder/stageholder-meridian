import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Link,
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
import { useTheme } from "next-themes";
import { useAutoSync, useSyncOnFocus } from "@repo/offline/hooks";
import { useNetworkStatusWithHeartbeat } from "@repo/offline/network";
import { isDesktop } from "@repo/core/platform";
import { cn } from "@/lib/utils";
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
import { checkForUpdate } from "@/lib/check-for-updates";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useUser } from "@/hooks/use-user";
import { useStageholder } from "@stageholder/sdk/spa";
import { LocalUserButton } from "@/components/layout/local-user-button";

// Lifecycle banners — replace the SDK's BFF-only `<PaymentFailedBanner>`
// and `<CancellationBanner>`. Both surfaced rare/edge subscription states
// that don't trigger in normal dev flow. Stubbed to null until we have
// SPA-compatible equivalents (would read `useSubscription().status` and
// render contextual copy when status is `past_due` or `canceled`).
const PaymentFailedBanner = () => null;
const CancellationBanner = () => null;
import { TrialPill } from "@/components/billing/trial-pill";
import {
  Button,
  IconButton,
  MacTrafficLightSpacer,
  Popover,
  Sidebar,
  Text,
  View,
  XStack,
  useSidebar,
} from "@stageholder/ui";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home, shortcutKey: "D" },
  {
    href: "/calendar",
    label: "Calendar",
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
    <div className="h-dvh overflow-hidden safe-area-top">
      <Sidebar.Provider defaultOpen height="100%">
        <AppShellBody>{children}</AppShellBody>
      </Sidebar.Provider>
    </div>
  );
}

function AppShellBody({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useStageholder();
  const { isMobile, setOpenMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const stableSyncAll = useCallback(() => syncAll(), []);
  // Heartbeat against the same-origin BFF proxy on web; on desktop the proxy
  // isn't reachable so fall back to VITE_API_URL.
  const apiUrl = isDesktop()
    ? import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"
    : "/api/v1";
  const heartbeatOnline = useNetworkStatusWithHeartbeat(`${apiUrl}/health`);
  const syncIntervalMs = isDesktop() ? 30_000 : 60_000;
  useAutoSync(stableSyncAll, {
    intervalMs: syncIntervalMs,
    isOnline: heartbeatOnline,
  });
  useSyncOnFocus(stableSyncAll);

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
      window.location.href = isDesktop() ? "/" : "/auth/login";
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
          <SidebarBrand />
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Menu>
            {navItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Sidebar.MenuItem key={item.href}>
                  <Sidebar.MenuButton
                    icon={<Icon className="size-4 text-sidebar-foreground" />}
                    isActive={isActive}
                    trailing={
                      <span className="inline-flex items-center gap-1">
                        <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                          G
                        </kbd>
                        <span className="text-[9px] text-muted-foreground/40">
                          →
                        </span>
                        <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                          {item.shortcutKey}
                        </kbd>
                      </span>
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
                icon={<Keyboard className="size-4 text-sidebar-foreground" />}
                onPress={() => setShortcutsDialogOpen(true)}
                trailing={
                  <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                    ?
                  </kbd>
                }
              >
                Shortcuts
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <FeedbackButton />
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
      </Sidebar>

      <Sidebar.Inset>
        {/* Top bar — XStack (not plain <header>) so RN-Web's flex model
            governs layout. Plain HTML inside an RNW View doesn't reliably
            pick up Tailwind flex utilities, which produced vertical-stack
            bugs on the right-side actions cluster. data-tauri-drag-region
            still works via Tamagui's prop forwarding. */}
        <XStack
          {...({ "data-tauri-drag-region": "" } as object)}
          height={48}
          shrink={0}
          items="center"
          gap="$3"
          px="$4"
          overflow="hidden"
          borderBottomWidth={1}
          borderColor="$borderColor"
          bg="$background"
          tag="header"
        >
          {/* Sidebar toggle — collapses the desktop rail / opens the mobile
              drawer. Replaces the previous custom mobile-only Drawer wrapper. */}
          <Sidebar.Trigger aria-label="Toggle navigation">
            <PanelLeft className="size-4" />
          </Sidebar.Trigger>

          {/* Browser-style nav, desktop only. Forward is always enabled —
              HTML5 history has no canGoForward signal; clicking when
              there's no forward entry is a no-op. */}
          {isDesktop() && (
            <XStack items="center" gap={2} className="hidden md:flex">
              <IconButton
                variant="ghost"
                size="sm"
                disabled={!canGoBack}
                onPress={() => window.history.back()}
                aria-label="Back"
                title="Back (⌘[)"
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => window.history.forward()}
                aria-label="Forward"
                title="Forward (⌘])"
              >
                <ChevronRight className="size-4" />
              </IconButton>
              <View width={1} height={16} bg="$borderColor" mx="$1" />
            </XStack>
          )}

          {/* Page title */}
          {currentPage && (
            <XStack items="center" gap="$2">
              <currentPage.icon className="size-4 shrink-0 text-muted-foreground" />
              <Text
                fontSize="$3"
                fontWeight="500"
                color="$color"
                className="hidden sm:block"
              >
                {currentPage.label}
              </Text>
            </XStack>
          )}

          {/* Spacer */}
          <XStack flex={1} minWidth={0} />

          {/* Right side actions */}
          <XStack shrink={0} items="center" gap="$1.5">
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setCommandPaletteOpen(true)}
              className="hidden gap-2 text-muted-foreground sm:flex"
              icon={<Search className="size-3.5" />}
            >
              <span className="text-xs">Search...</span>
              <kbd className="pointer-events-none ml-1 hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                ⌘K
              </kbd>
            </Button>
            <DailyTargetRings />
            <View width={1} height={16} bg="$borderColor" mx="$1" />
            <OfflineIndicator />
            <TrialPill />

            {/* Journey progress popover */}
            {userLight &&
              (() => {
                const progress = getTierProgress(
                  userLight.totalLight,
                  userLight.currentTier,
                );
                const nextTier = getNextTier(userLight.currentTier);
                const tierColors: Record<
                  number,
                  {
                    ring: [string, string, string];
                    track: string;
                    glow: string;
                  }
                > = {
                  1: {
                    ring: ["#94a3b8", "#cbd5e1", "#94a3b8"],
                    track: "rgba(148,163,184,0.15)",
                    glow: "#cbd5e1",
                  },
                  2: {
                    ring: ["#ef4444", "#fca5a5", "#ef4444"],
                    track: "rgba(239,68,68,0.15)",
                    glow: "#ef4444",
                  },
                  3: {
                    ring: ["#dc2626", "#f59e0b", "#fbbf24"],
                    track: "rgba(245,158,11,0.15)",
                    glow: "#f59e0b",
                  },
                  4: {
                    ring: ["#dc2626", "#f97316", "#fbbf24"],
                    track: "rgba(249,115,22,0.15)",
                    glow: "#f97316",
                  },
                  5: {
                    ring: ["#ea580c", "#f97316", "#fbbf24"],
                    track: "rgba(249,115,22,0.15)",
                    glow: "#f97316",
                  },
                  6: {
                    ring: ["#a16207", "#eab308", "#fde68a"],
                    track: "rgba(234,179,8,0.15)",
                    glow: "#eab308",
                  },
                  7: {
                    ring: ["#a16207", "#fbbf24", "#fef9c3"],
                    track: "rgba(251,191,36,0.15)",
                    glow: "#fbbf24",
                  },
                  8: {
                    ring: ["#ca8a04", "#fde68a", "#ffffff"],
                    track: "rgba(253,230,138,0.15)",
                    glow: "#fde68a",
                  },
                  9: {
                    ring: ["#854d0e", "#eab308", "#fde68a"],
                    track: "rgba(234,179,8,0.15)",
                    glow: "#eab308",
                  },
                  10: {
                    ring: ["#f59e0b", "#fbbf24", "#ffffff"],
                    track: "rgba(251,191,36,0.15)",
                    glow: "#fbbf24",
                  },
                };
                const colors = (tierColors[userLight.currentTier] ??
                  tierColors[1])!;
                return (
                  <Popover placement="bottom-end">
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="group relative rounded-md py-1 pl-2 pr-1 transition-colors hover:bg-accent"
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          className="relative text-[11px] font-semibold tracking-wide"
                          style={{
                            background: `linear-gradient(90deg, ${colors.ring[0]}, ${colors.ring[1]}, ${colors.ring[2]}, ${colors.ring[1]}, ${colors.ring[0]})`,
                            backgroundSize: "200% 100%",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "shimmer 3s ease-in-out infinite",
                          }}
                        >
                          {userLight.currentTitle}
                        </span>
                        <div
                          className="relative shrink-0"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                          }}
                        >
                          <span
                            className="pointer-events-none absolute inset-0 m-auto size-6 rounded-full opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-40"
                            style={{
                              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                            }}
                          />
                          <svg
                            className="absolute inset-0 -rotate-90"
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                          >
                            <defs>
                              <linearGradient
                                id="light-ring-grad"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor={colors.ring[0]} />
                                <stop offset="50%" stopColor={colors.ring[1]} />
                                <stop
                                  offset="100%"
                                  stopColor={colors.ring[2]}
                                />
                              </linearGradient>
                            </defs>
                            <circle
                              cx={14}
                              cy={14}
                              r={12.75}
                              fill="none"
                              stroke={colors.track}
                              strokeWidth={2.5}
                            />
                            {progress > 0 && (
                              <circle
                                cx={14}
                                cy={14}
                                r={12.75}
                                fill="none"
                                stroke="url(#light-ring-grad)"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 12.75}`}
                                strokeDashoffset={`${2 * Math.PI * 12.75 * (1 - Math.min(100, progress) / 100)}`}
                                className="transition-all duration-700"
                              />
                            )}
                          </svg>
                          <StarVisual
                            tier={userLight.currentTier}
                            size="xs"
                            className="relative"
                          />
                        </div>
                      </button>
                    </Popover.Trigger>
                    <Popover.Content className="w-64 max-w-[calc(100vw-2rem)] p-0">
                      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3">
                        <StarVisual
                          tier={userLight.currentTier}
                          size="lg"
                          animate
                        />
                        <p className="text-sm font-bold">
                          {userLight.currentTitle}
                        </p>
                        <p className="text-[11px] text-muted-foreground text-center leading-snug px-1">
                          {
                            LIGHT_TIERS[userLight.currentTier - 1]
                              ?.shortDescription
                          }
                        </p>
                        {nextTier ? (
                          <div className="w-full space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-center text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {userLight.totalLight}
                              </span>
                              {" / "}
                              {nextTier.lightRequired} Light
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {userLight.totalLight.toLocaleString()} Light — Max
                            tier reached
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 border-t border-border/50 text-center">
                        <div className="border-r border-border/50 py-2.5">
                          <p className="text-xs font-bold">
                            {userLight.perfectDayStreak}d
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Streak
                          </p>
                        </div>
                        <div className="border-r border-border/50 py-2.5">
                          <p className="text-xs font-bold">
                            {userLight.perfectDaysTotal}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Perfect
                          </p>
                        </div>
                        <div className="py-2.5">
                          <p className="text-xs font-bold">
                            {userLight.longestPerfectStreak}d
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Best
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/journey"
                        className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        My Journey →
                      </Link>
                    </Popover.Content>
                  </Popover>
                );
              })()}

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
                  icon: <UserCog className="size-4" />,
                },
                {
                  // Single billing entry — matches every major SaaS
                  // (Notion, Linear, Stripe, Vercel, GitHub, Slack: one
                  // item that navigates to the billing page). The dialog
                  // stays in the codebase but only fires CONTEXTUALLY
                  // when a user hits a feature limit — not from menu nav.
                  label: "Plans & billing",
                  href: "/settings/billing",
                  icon: <CreditCard className="size-4" />,
                },
                {
                  kind: "switch",
                  label: "Dark mode",
                  value: isDark,
                  onChange: (next) => setTheme(next ? "dark" : "light"),
                  icon: <Moon className="size-4" />,
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
                          void checkForUpdate({ showWhenUpToDate: true }),
                        icon: <RefreshCw className="size-4" />,
                      },
                    ]
                  : []),
                {
                  label: "Sign out",
                  onSelect: () => void handleLogout(),
                  icon: <LogOut className="size-4" />,
                },
              ]}
            />
            {/* hideSignOut is accepted for API parity but is a no-op —
                LocalUserButton never renders a built-in sign-out. */}
          </XStack>
        </XStack>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px)))] md:pb-0">
          {/* Lifecycle banners — render conditionally based on the active
              subscription's status. Each is null when not applicable so
              only one (at most) renders at a time in practice. The trial
              countdown lives in the header as <TrialPill> instead of a
              page-width strip. PaymentFailed and Cancellation stay as
              banners — they're rare, urgent, and demand to be read in
              full. */}
          <div className="mx-auto w-full max-w-5xl space-y-2 px-4 pt-3 empty:pt-0">
            <PaymentFailedBanner />
            <CancellationBanner />
          </div>
          {children}
        </main>

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
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-md p-2 text-sm",
        iconified && "justify-center",
      )}
    >
      <MeridianLogo size="md" />
      {!iconified && (
        <span className="flex-1 truncate text-lg font-semibold text-sidebar-foreground">
          Meridian
        </span>
      )}
    </div>
  );
}
