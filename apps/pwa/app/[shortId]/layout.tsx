"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Target,
  Settings,
  LogOut,
  Menu,
  ChevronsUpDown,
  Plus,
  Check,
  LayoutGrid,
  Search,
  Keyboard,
} from "lucide-react";
import { useAutoSync, useSyncOnFocus } from "@repo/offline/hooks";
import { useNetworkStatusWithHeartbeat } from "@repo/offline/network";
import { isDesktop } from "@repo/core/platform";
import type { Workspace } from "@repo/core/types";
import { cn } from "@/lib/utils";
import { syncAll } from "@/lib/offline";
import { useUserLight } from "@/lib/api/light";
import { StarVisual } from "@/components/light/star-visual";
import { getTierProgress, getNextTier } from "@repo/core/types/light";
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
import apiClient from "@/lib/api-client";
import { logout } from "@/lib/logout";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { href: "/dashboard", label: "Dashboard", icon: Home, shortcutKey: "D" },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    shortcutKey: "C",
  },
  { href: "/todos", label: "Todos", icon: CheckSquare, shortcutKey: "T" },
  { href: "/habits", label: "Habits", icon: Target, shortcutKey: "H" },
  { href: "/journal", label: "Journal", icon: BookOpen, shortcutKey: "J" },
  { href: "/settings", label: "Settings", icon: Settings, shortcutKey: "S" },
];

function WorkspaceSelector({
  workspace,
  workspaces,
  onNavigate,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent/50 transition-colors">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
            {workspace.name}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => {
              onNavigate?.();
              router.push(`/${ws.shortId}/dashboard`);
            }}
          >
            <div className="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {ws.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate">{ws.name}</span>
            {ws.id === workspace.id && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            onNavigate?.();
            router.push("/workspaces?browse=true");
          }}
        >
          <LayoutGrid className="size-4" />
          All workspaces
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onNavigate?.();
            router.push("/workspaces?create=true");
          }}
        >
          <Plus className="size-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({
  shortId,
  pathname,
  onNavigate,
}: {
  shortId: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navItems.map((item) => {
        const fullHref = `/${shortId}${item.href}`;
        const isActive =
          pathname === fullHref || pathname.startsWith(fullHref + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={fullHref}
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

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ shortId: string }>();
  const shortId = params.shortId;
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const stableSyncAll = useCallback(() => syncAll(), []);
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const heartbeatOnline = useNetworkStatusWithHeartbeat(`${apiUrl}/health`);
  const syncIntervalMs = isDesktop() ? 30_000 : 60_000;
  useAutoSync(stableSyncAll, {
    intervalMs: syncIntervalMs,
    isOnline: heartbeatOnline,
  });
  useSyncOnFocus(stableSyncAll);

  const { data: userLight } = useUserLight();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
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
  useGlobalShortcuts(shortId, shortcutCallbacks);

  useEffect(() => {
    if (user && user.onboardingCompleted === false) {
      router.replace("/onboarding");
    }
  }, [user, router]);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkspace() {
      try {
        const [wsRes, listRes] = await Promise.all([
          apiClient.get<Workspace>(`/workspaces/${shortId}`),
          apiClient.get<Workspace[]>("/workspaces"),
        ]);
        if (cancelled) return;
        setWorkspace(wsRes.data);
        setActiveWorkspace(wsRes.data.id);
        const list = Array.isArray(listRes.data) ? listRes.data : [];
        setWorkspaces(list);
      } catch {
        if (!cancelled) router.replace("/workspaces");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWorkspace();
    return () => {
      cancelled = true;
    };
  }, [shortId, router, setActiveWorkspace]);

  async function handleLogout() {
    await logout();
    clearUser();
    router.push("/login");
  }

  const currentPage = navItems.find(
    (item) =>
      pathname === `/${shortId}${item.href}` ||
      pathname.startsWith(`/${shortId}${item.href}/`),
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <WorkspaceProvider workspace={workspace}>
      <SyncConflictListener />
      <UpdateChecker />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        shortId={shortId}
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
        listId=""
      />
      <div className="flex h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          {/* Workspace selector */}
          <div className="p-3">
            <WorkspaceSelector workspace={workspace} workspaces={workspaces} />
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto py-1">
            <SidebarNav shortId={shortId} pathname={pathname} />
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
        <div className="flex flex-1 flex-col">
          {/* Top header */}
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
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
                  <SheetTitle asChild>
                    <WorkspaceSelector
                      workspace={workspace}
                      workspaces={workspaces}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </SheetTitle>
                </SheetHeader>
                <SidebarNav
                  shortId={shortId}
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
                  <currentPage.icon className="size-4 text-muted-foreground" />
                  <h1 className="text-sm font-medium text-foreground">
                    {currentPage.label}
                  </h1>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-1.5">
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
                  // Tier-specific color palettes matching star-visual.tsx
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
                    }, // Stargazer — silver
                    2: {
                      ring: ["#ef4444", "#fca5a5", "#ef4444"],
                      track: "rgba(239,68,68,0.15)",
                      glow: "#ef4444",
                    }, // Spark — red
                    3: {
                      ring: ["#dc2626", "#f59e0b", "#fbbf24"],
                      track: "rgba(245,158,11,0.15)",
                      glow: "#f59e0b",
                    }, // Ember — red to amber
                    4: {
                      ring: ["#dc2626", "#f97316", "#fbbf24"],
                      track: "rgba(249,115,22,0.15)",
                      glow: "#f97316",
                    }, // Flame — red-orange-yellow
                    5: {
                      ring: ["#ea580c", "#f97316", "#fbbf24"],
                      track: "rgba(249,115,22,0.15)",
                      glow: "#f97316",
                    }, // Radiant — orange-gold
                    6: {
                      ring: ["#a16207", "#eab308", "#fde68a"],
                      track: "rgba(234,179,8,0.15)",
                      glow: "#eab308",
                    }, // Flare — deep gold
                    7: {
                      ring: ["#a16207", "#fbbf24", "#fef9c3"],
                      track: "rgba(251,191,36,0.15)",
                      glow: "#fbbf24",
                    }, // Nova — gold to white
                    8: {
                      ring: ["#ca8a04", "#fde68a", "#ffffff"],
                      track: "rgba(253,230,138,0.15)",
                      glow: "#fde68a",
                    }, // Pulsar — gold-white
                    9: {
                      ring: ["#854d0e", "#eab308", "#fde68a"],
                      track: "rgba(234,179,8,0.15)",
                      glow: "#eab308",
                    }, // Supernova — deep gold
                    10: {
                      ring: ["#f59e0b", "#fbbf24", "#ffffff"],
                      track: "rgba(251,191,36,0.15)",
                      glow: "#fbbf24",
                    }, // Meridian — gold to white
                  };
                  const colors = (tierColors[userLight.currentTier] ??
                    tierColors[1])!;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="group relative flex items-center gap-1.5 rounded-md py-1 pl-2 pr-1 transition-colors hover:bg-accent">
                          {/* Title text with shimmer — left side */}
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
                          {/* Ring + star — right side, same size as daily target rings */}
                          <div
                            className="relative inline-flex shrink-0 items-center justify-center"
                            style={{ width: 28, height: 28 }}
                          >
                            {/* Ambient glow */}
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
                      <PopoverContent align="end" className="w-64 p-0">
                        <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3">
                          <StarVisual
                            tier={userLight.currentTier}
                            size="lg"
                            animate
                          />
                          <p className="text-sm font-bold">
                            {userLight.currentTitle}
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
                          href={`/${shortId}/journey`}
                          className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          My Journey →
                        </Link>
                      </PopoverContent>
                    </Popover>
                  );
                })()}

              <ThemeToggle />

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Avatar className="size-6">
                      {user?.avatar && (
                        <AvatarImage
                          src={user.avatar}
                          alt={user?.name || "User"}
                        />
                      )}
                      <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium">
                        {user?.name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email || ""}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
