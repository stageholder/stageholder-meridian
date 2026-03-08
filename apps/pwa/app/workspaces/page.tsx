"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Workspace } from "@repo/core/types";

export default function WorkspacesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    try {
      const res = await apiClient.get<Workspace[]>("/workspaces");
      const list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) => (a.isPersonal === b.isPersonal ? 0 : a.isPersonal ? -1 : 1));
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
      const res = await apiClient.post<Workspace>("/workspaces", { name: name.trim() });
      router.push(`/${res.data.shortId}/dashboard`);
    } catch {
      setError("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspaces.length > 0 ? "Select a workspace to continue" : "Create a workspace to get started"}
          </p>
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        {workspaces.length > 0 && (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => selectWorkspace(ws)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {ws.name}
                    {ws.isPersonal && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Personal
                      </span>
                    )}
                  </p>
                  {ws.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{ws.description}</p>
                  )}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {!showCreate && workspaces.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-lg border border-dashed border-border p-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            + Create new workspace
          </button>
        )}

        {showCreate && (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <label htmlFor="ws-name" className="block text-sm font-medium text-foreground">
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
              <button
                type="submit"
                disabled={creating}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create workspace"}
              </button>
              {workspaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
