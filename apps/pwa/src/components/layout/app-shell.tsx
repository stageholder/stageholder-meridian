import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useCanGoBack, useRouterState } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Target,
  Settings,
  LogOut,
  Menu,
  Search,
  Keyboard,
  CreditCard,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { FeedbackButton } from "@/components/shared/feedback-button";
import { CommandPalette } from "@/components/shared/command-palette";
import { ShortcutsDialog } from "@/components/shared/shortcuts-dialog";
import { MeridianLogo } from "@/components/shared/meridian-logo";
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
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navItems.map((item) => {
        const isActive = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
            <span className="ml-auto hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:inline-flex">
              <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                G
              </kbd>
              <span className="text-[9px] text-muted-foreground/40">→</span>
              <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                {item.shortcutKey}
              </kbd>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useUser();
  const { signOut } = useStageholder();
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

  const [mobileOpen, setMobileOpen] = useState(false);
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
  // macOS-only padding for the traffic lights that overlay the header
  // when `titleBarStyle: "Overlay"` is set in tauri.conf.json.
  const isMacDesktop =
    isDesktop() &&
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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
      <div className="flex h-dvh overflow-hidden bg-background safe-area-top">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          {/* macOS traffic-light clearance. titleBarStyle: Overlay lets the
              window content extend under the title bar, so the top ~28px
              of the sidebar (where the brand would sit) is overlapped by
              the traffic lights. This drag-region spacer pushes the brand
              down and doubles as a window drag handle. */}
          {isMacDesktop && (
            <div data-tauri-drag-region className="h-7 shrink-0" />
          )}
          {/* Brand */}
          <div className="p-3">
            <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm">
              <MeridianLogo size="md" />
              <span className="flex-1 truncate text-lg font-semibold text-sidebar-foreground">
                Meridian
              </span>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto py-1">
            <SidebarNav pathname={pathname} />
          </div>

          {/* Bottom actions */}
          <div className="border-t border-sidebar-border px-3 py-2">
            <button
              onClick={() => setShortcutsDialogOpen(true)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            >
              <Keyboard className="size-4" />
              Shortcuts
              <span className="ml-auto inline-flex items-center">
                <kbd className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 font-mono text-[10px] font-medium text-muted-foreground/60">
                  ?
                </kbd>
              </span>
            </button>
            <FeedbackButton />
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top header. data-tauri-drag-region makes empty header space a
              window drag handle (Tauri auto-excludes interactive children).
              No traffic-light padding here — the lights sit over the
              sidebar, which is to the LEFT of this header. */}
          <header
            data-tauri-drag-region
            className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-background px-4"
          >
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="md:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0">
                <SheetHeader className="p-3">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm">
                    <MeridianLogo size="md" />
                    <span className="flex-1 truncate text-lg font-semibold text-sidebar-foreground">
                      Meridian
                    </span>
                  </div>
                </SheetHeader>
                <SidebarNav
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
                <div className="mt-auto border-t border-sidebar-border px-3 py-2">
                  <FeedbackButton onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Browser-style nav, desktop only. Forward is always enabled —
                HTML5 history has no canGoForward signal; clicking when
                there's no forward entry is a no-op. */}
            {isDesktop() && (
              <div className="hidden items-center gap-0.5 md:flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!canGoBack}
                  onClick={() => window.history.back()}
                  title="Back (⌘[)"
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Back</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => window.history.forward()}
                  title="Forward (⌘])"
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Forward</span>
                </Button>
                <div className="mx-1 h-4 w-px bg-border" />
              </div>
            )}

            {/* Page title */}
            <div className="flex items-center gap-2">
              {currentPage && (
                <>
                  <currentPage.icon className="size-4 shrink-0 text-muted-foreground" />
                  <h1 className="hidden text-sm font-medium text-foreground sm:block">
                    {currentPage.label}
                  </h1>
                </>
              )}
            </div>

            <div className="min-w-0 flex-1" />

            {/* Right side */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden gap-2 text-muted-foreground sm:flex"
              >
                <Search className="size-3.5" />
                <span className="text-xs">Search...</span>
                <kbd className="pointer-events-none ml-1 hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                  ⌘K
                </kbd>
              </Button>
              <DailyTargetRings />
              <div className="mx-0.5 h-4 w-px bg-border" />
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="group relative flex items-center gap-1.5 rounded-md py-1 pl-2 pr-1 transition-colors hover:bg-accent">
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
                            className="relative inline-flex shrink-0 items-center justify-center"
                            style={{ width: 28, height: 28 }}
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
                                  <stop
                                    offset="0%"
                                    stopColor={colors.ring[0]}
                                  />
                                  <stop
                                    offset="50%"
                                    stopColor={colors.ring[1]}
                                  />
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
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-64 max-w-[calc(100vw-2rem)] p-0"
                      >
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
                              {userLight.totalLight.toLocaleString()} Light —
                              Max tier reached
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
                      </PopoverContent>
                    </Popover>
                  );
                })()}

              <ThemeToggle />

              {/* User menu — local replacement for the SDK's UserButton
                  (which is BFF-only / unreachable under SPA). Same menu
                  contract; sign-out always routes through our handleLogout
                  so any future desktop branch is preserved. */}
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
                    label: "Sign out",
                    onSelect: () => void handleLogout(),
                    icon: <LogOut className="size-4" />,
                  },
                ]}
              />
              {/* hideSignOut is accepted for API parity but is a no-op —
                  LocalUserButton never renders a built-in sign-out. */}
            </div>
          </header>

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
        </div>
      </div>
    </>
  );
}
