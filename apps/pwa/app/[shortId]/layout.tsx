"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Home,
  CheckSquare,
  BookOpen,
  Target,
  Settings,
  LogOut,
  Menu,
  ChevronsUpDown,
} from "lucide-react";
import { useAutoSync } from "@repo/offline/hooks";
import type { Workspace } from "@repo/core/types";
import { cn } from "@/lib/utils";
import { syncAll } from "@/lib/offline";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import apiClient from "@/lib/api-client";
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
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
  useAutoSync(stableSyncAll, 60_000);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkspace() {
      try {
        const res = await apiClient.get<Workspace>(`/workspaces/${shortId}`);
        if (cancelled) return;
        setWorkspace(res.data);
        setActiveWorkspace(res.data.id);
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
    document.cookie = "logged_in=; path=/; max-age=0";
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
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          {/* Logo */}
          <div className="flex h-12 items-center px-4">
            <Link href={`/${shortId}/dashboard`} className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                M
              </div>
              <span className="text-sm font-semibold text-sidebar-foreground">Meridian</span>
            </Link>
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Nav */}
          <div className="flex-1 overflow-y-auto py-1">
            <SidebarNav shortId={shortId} pathname={pathname} />
          </div>

          <Separator className="bg-sidebar-border" />

          {/* User footer */}
          <div className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent/50 transition-colors">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.name || "User"}</p>
                    <p className="truncate text-[11px] text-sidebar-foreground/50">{user?.email || ""}</p>
                  </div>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{user?.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <SheetHeader className="px-4 py-3">
                  <SheetTitle className="flex items-center gap-2 text-sm">
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                      M
                    </div>
                    Meridian
                  </SheetTitle>
                </SheetHeader>
                <Separator />
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
            <div className="flex items-center gap-2">
              <OfflineIndicator />

              {/* Mobile user menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="md:hidden">
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
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
