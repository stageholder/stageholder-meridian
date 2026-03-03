"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { Workspace } from "@repo/core/types";

export function WorkspaceSettings() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace", activeWorkspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${activeWorkspaceId}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || "");
    }
  }, [workspace]);

  const updateWorkspace = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      const res = await apiClient.patch(`/workspaces/${activeWorkspaceId}`, data);
      return res.data as Workspace;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", activeWorkspaceId] });
      toast.success("Workspace updated");
    },
    onError: () => {
      toast.error("Failed to update workspace");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Workspace name is required");
      return;
    }
    updateWorkspace.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  }

  if (!activeWorkspaceId) {
    return <p className="text-sm text-muted-foreground">No workspace selected.</p>;
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading workspace...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="workspace-name" className="block text-sm font-medium text-foreground">
          Workspace Name
        </label>
        <input
          id="workspace-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="workspace-description" className="block text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          id="workspace-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your workspace"
          rows={3}
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={updateWorkspace.isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {updateWorkspace.isPending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
