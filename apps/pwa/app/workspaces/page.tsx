"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Workspace } from "@repo/core/types";

const AVATAR_HUES = [210, 145, 25, 280, 55, 330, 170, 95, 245, 10];
const PERSONAL_HUE = 210;

function hashToHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]!;
}

function WorkspaceAvatar({
  workspace,
  className = "",
}: {
  workspace: Workspace;
  className?: string;
}) {
  const hue = workspace.isPersonal ? PERSONAL_HUE : hashToHue(workspace.id);
  const initial = workspace.name.charAt(0).toUpperCase();

  return (
    <div className={className}>
      {/* Light mode */}
      <div
        className="flex size-10 items-center justify-center rounded-lg text-sm font-bold dark:hidden"
        style={{
          backgroundColor: `oklch(0.93 0.05 ${hue})`,
          color: `oklch(0.35 0.15 ${hue})`,
        }}
      >
        {initial}
      </div>
      {/* Dark mode */}
      <div
        className="hidden size-10 items-center justify-center rounded-lg text-sm font-bold dark:flex"
        style={{
          backgroundColor: `oklch(0.25 0.06 ${hue})`,
          color: `oklch(0.8 0.12 ${hue})`,
        }}
      >
        {initial}
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex items-center gap-3 animate-[bento-enter_0.4s_ease-out_both]">
            <div className="size-10 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      }
    >
      <WorkspacesContent />
    </Suspense>
  );
}

function WorkspacesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsCreate = searchParams.get("create") === "true";
  const wantsBrowse = searchParams.get("browse") === "true";
  const user = useAuthStore((s) => s.user);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(wantsCreate);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    try {
      const res = await apiClient.get<Workspace[]>("/workspaces");
      const list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) =>
        a.isPersonal === b.isPersonal ? 0 : a.isPersonal ? -1 : 1,
      );

      // Auto-redirect for single workspace (unless user explicitly navigated here)
      if (list.length === 1 && !wantsCreate && !wantsBrowse) {
        router.replace(`/${list[0]!.shortId}/dashboard`);
        return;
      }

      setWorkspaces(list);
    } catch {
      setError("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }

  function selectWorkspace(ws: Workspace) {
    router.push(`/${ws.shortId}/dashboard`);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");

    try {
      const res = await apiClient.post<Workspace>("/workspaces", {
        name: name.trim(),
      });
      router.push(`/${res.data.shortId}/dashboard`);
    } catch {
      setError("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  const firstName = user?.name?.split(" ")[0];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 animate-[bento-enter_0.4s_ease-out_both]">
          <div className="size-10 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 size-96 rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 size-80 rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 animate-[bento-enter_0.4s_ease-out_both]">
          {user?.avatar && (
            <Avatar className="size-12">
              <AvatarImage src={user.avatar} alt={user.name ?? ""} />
              <AvatarFallback>{firstName?.charAt(0) ?? "U"}</AvatarFallback>
            </Avatar>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {workspaces.length > 0
                ? "Choose a workspace to continue"
                : "Create a workspace to get started"}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        {/* Workspace list */}
        {workspaces.length > 0 && (
          <div className="space-y-2">
            {workspaces.map((ws, i) => (
              <button
                key={ws.id}
                onClick={() => selectWorkspace(ws)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 animate-[bento-enter_0.4s_ease-out_both]"
                style={{ animationDelay: `${(i + 1) * 75}ms` }}
              >
                <WorkspaceAvatar
                  workspace={ws}
                  className="shrink-0 transition-transform duration-200 group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{ws.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">
                    {ws.isPersonal
                      ? "Your private workspace"
                      : ws.description || "Team workspace"}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}

        {/* Create workspace CTA */}
        {!showCreate && workspaces.length > 0 && (
          <div
            className="animate-[bento-enter_0.4s_ease-out_both]"
            style={{
              animationDelay: `${(workspaces.length + 1) * 75}ms`,
            }}
          >
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4" />
              Create new workspace
            </Button>
          </div>
        )}

        {/* Create workspace form */}
        {showCreate && (
          <Card className="p-4 animate-[bento-enter_0.4s_ease-out_both]">
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label
                  htmlFor="ws-name"
                  className="block text-sm font-medium text-foreground"
                >
                  Workspace name
                </label>
                <input
                  id="ws-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Workspace"
                  autoFocus
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating} className="flex-1">
                  {creating ? "Creating..." : "Create workspace"}
                </Button>
                {workspaces.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
