"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ThemeToggle } from "@/components/shared/theme-toggle";
import apiClient from "@/lib/api-client";
import { clearLoggedInFlag } from "@/lib/auth-helpers";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
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
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => { onNavigate?.(); router.push(`/${ws.shortId}/dashboard`); }}
          >
            <div className="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {ws.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate">{ws.name}</span>
            {ws.id === workspace.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { onNavigate?.(); router.push("/workspaces"); }}>
          <LayoutGrid className="size-4" />
          All workspaces
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onNavigate?.(); router.push("/workspaces"); }}>
          <Plus className="size-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({ shortId, pathname, onNavigate }: { shortId: string; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navItems.map((item) => {
        const fullHref = `/${shortId}${item.href}`;
        const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={fullHref}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ shortId: string }>();
  const shortId = params.shortId;
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const stableSyncAll = useCallback(() => syncAll(), []);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const heartbeatOnline = useNetworkStatusWithHeartbeat(`${apiUrl}/health`);
  const syncIntervalMs = isDesktop() ? 30_000 : 60_000;
  useAutoSync(stableSyncAll, { intervalMs: syncIntervalMs, isOnline: heartbeatOnline });
  useSyncOnFocus(stableSyncAll);

  const { data: userLight } = useUserLight();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    return () => { cancelled = true; };
  }, [shortId, router, setActiveWorkspace]);

  async function handleLogout() {
    try { await apiClient.post("/auth/logout"); } catch { /* ignore */ }
    clearUser();
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("workspace-storage");
    clearLoggedInFlag();
    router.push("/login");
  }

  const currentPage = navItems.find(
    (item) => pathname === `/${shortId}${item.href}` || pathname.startsWith(`/${shortId}${item.href}/`)
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <WorkspaceProvider workspace={workspace}>
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
                <SidebarNav shortId={shortId} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* Page title */}
            <div className="flex items-center gap-2">
              {currentPage && (
                <>
                  <currentPage.icon className="size-4 text-muted-foreground" />
                  <h1 className="text-sm font-medium text-foreground">{currentPage.label}</h1>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-1.5">
              <OfflineIndicator />

              {/* Journey progress popover */}
              {userLight && (() => {
                const progress = getTierProgress(userLight.totalLight, userLight.currentTier);
                const nextTier = getNextTier(userLight.currentTier);
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent">
                        {/* Progress ring around the star */}
                        <svg className="absolute inset-0 size-9 -rotate-90" viewBox="0 0 36 36">
                          {progress > 0 && (
                            <circle cx={18} cy={18} r={16} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" strokeDasharray={`${Math.max(8, (progress / 100) * 2 * Math.PI * 16)} ${2 * Math.PI * 16}`} />
                          )}
                        </svg>
                        <StarVisual tier={userLight.currentTier} size="sm" className="relative" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-0">
                      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3">
                        <StarVisual tier={userLight.currentTier} size="lg" animate />
                        <p className="text-sm font-bold">{userLight.currentTitle}</p>
                        {nextTier ? (
                          <div className="w-full space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-center text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{userLight.totalLight}</span>
                              {" / "}
                              {nextTier.lightRequired} Light
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {userLight.totalLight.toLocaleString()} Light — Max tier reached
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 border-t border-border/50 text-center">
                        <div className="border-r border-border/50 py-2.5">
                          <p className="text-xs font-bold">{userLight.perfectDayStreak}d</p>
                          <p className="text-[10px] text-muted-foreground">Streak</p>
                        </div>
                        <div className="border-r border-border/50 py-2.5">
                          <p className="text-xs font-bold">{userLight.perfectDaysTotal}</p>
                          <p className="text-[10px] text-muted-foreground">Perfect</p>
                        </div>
                        <div className="py-2.5">
                          <p className="text-xs font-bold">{userLight.longestPerfectStreak}d</p>
                          <p className="text-[10px] text-muted-foreground">Best</p>
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
                      <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium">{user?.name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleLogout}>
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
