"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";
import { useAutoSync, useSyncOnFocus } from "@repo/offline/hooks";
import { useNetworkStatusWithHeartbeat } from "@repo/offline/network";
import { isDesktop } from "@repo/core/platform";
import { cn } from "@/lib/utils";
import { syncAll } from "@/lib/offline";
import { announceLogout, subscribeLogout } from "@/lib/auth-broadcast";
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
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useUser } from "@/hooks/use-user";
import {
  useStageholder,
  UserButton,
  PricingDialog,
} from "@stageholder/sdk/react";
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

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://id.stageholder.com";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Home, shortcutKey: "D" },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarDays,
    shortcutKey: "C",
  },
  { href: "/app/todos", label: "Todos", icon: CheckSquare, shortcutKey: "T" },
  { href: "/app/habits", label: "Habits", icon: Target, shortcutKey: "H" },
  { href: "/app/journal", label: "Journal", icon: BookOpen, shortcutKey: "J" },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    shortcutKey: "S",
  },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
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
            href={item.href}
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { signOut } = useStageholder();
  const stableSyncAll = useCallback(() => syncAll(), []);
  // Heartbeat against the same-origin BFF proxy on web; on desktop the proxy
  // isn't reachable so fall back to NEXT_PUBLIC_API_URL.
  const apiUrl = isDesktop()
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
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
  const [pricingOpen, setPricingOpen] = useState(false);

  const shortcutCallbacks = useMemo(
    () => ({
      setCommandPaletteOpen,
      setShortcutsDialogOpen,
      setCreateTodoDialogOpen,
    }),
    [],
  );
  useGlobalShortcuts(shortcutCallbacks);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      if (isDesktop()) {
        // On desktop, unauthenticated state is handled by DesktopAuthBoot at
        // the root layout. Bounce to `/` which will unmount this subtree and
        // render the sign-in screen.
        router.replace("/");
      } else {
        router.replace("/auth/login");
      }
      return;
    }
    // Client-side onboarding gate: catches desktop (no BFF callback), direct
    // URL hits, and cache drift after a cross-tab completion. Server-side
    // gate in /auth/callback still handles the happy path on web without
    // UI flash.
    if (user.hasCompletedOnboarding === false) {
      router.replace("/onboarding");
    }
  }, [user, userLoading, router]);

  // Listen for sign-outs from other tabs — hard-navigate so the new page load
  // runs through the auth proxy and the user lands on /auth/login cleanly.
  useEffect(() => {
    return subscribeLogout(() => {
      window.location.href = isDesktop() ? "/" : "/auth/login";
    });
  }, []);

  async function handleLogout() {
    if (isDesktop()) {
      // Desktop has no iron-session cookie / BFF logout route. Revoke the
      // refresh token, clear the local store, and bounce to the root so
      // DesktopAuthBoot re-prompts for sign-in. Safe to broadcast here —
      // there's no Hub session negotiation to race against, the Hub session
      // lives in the external system browser and is orthogonal.
      const { signOutTauri } = await import("@/lib/oidc-tauri");
      await signOutTauri();
      announceLogout();
      window.location.href = "/";
      return;
    }
    // SDK signOut sends the X-Stageholder-CSRF header (required by the BFF's
    // /auth/logout route) and follows the 302 to the Hub's end-session
    // endpoint, which lands on /goodbye. We deliberately do NOT broadcast
    // here: at this point the Hub session is still alive, so peer tabs
    // navigating to /auth/login would silent-SSO straight back in. /goodbye
    // owns the broadcast — that's the only moment the Hub has ended.
    await signOut();
  }

  const currentPage = navItems.find((item) => isNavActive(pathname, item.href));

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

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
          {/* Brand */}
          <div className="p-3">
            <div className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                M
              </div>
              <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
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
          {/* Top header */}
          <header className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-background px-4">
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
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                      M
                    </div>
                    <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
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
                          href="/app/journey"
                          className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          My Journey →
                        </Link>
                      </PopoverContent>
                    </Popover>
                  );
                })()}

              <ThemeToggle />

              {/* User menu — SDK primitive. The built-in sign-out only runs
                  the SDK web logout flow; we hide it and pass a custom
                  "Sign out" item so the desktop branch (signOutTauri + Hub
                  revoke) still fires correctly via handleLogout. */}
              <UserButton
                hideSignOut
                menuItems={[
                  {
                    label: "Account settings",
                    href: `${HUB_URL}/account/profile`,
                    icon: <UserCog className="size-4" />,
                  },
                  {
                    label: "Billing",
                    href: "/app/settings/billing",
                    icon: <CreditCard className="size-4" />,
                  },
                  {
                    label: "Upgrade plan",
                    onSelect: () => setPricingOpen(true),
                    icon: <CreditCard className="size-4" />,
                  },
                  {
                    label: "Sign out",
                    onSelect: () => void handleLogout(),
                    icon: <LogOut className="size-4" />,
                  },
                ]}
              />

              {/* Pricing dialog — controlled by the menu item. Renders the
                  same SDK <PricingTable /> in a centered modal so users can
                  upgrade in-context without leaving the app. */}
              <PricingDialog
                product="meridian"
                open={pricingOpen}
                onOpenChange={setPricingOpen}
                title="Choose a plan"
                description="Upgrade or change your plan anytime. Cancel from the billing page."
              />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px)))] md:pb-0">
            {children}
          </main>

          {/* Mobile bottom navigation */}
          <MobileBottomNav />
        </div>
      </div>
    </>
  );
}
