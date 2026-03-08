"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import type { Workspace } from "@repo/core/types";

export function WorkspaceSettings() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: workspaceData, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace", workspace.id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}`);
      return res.data;
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (workspaceData) {
      setName(workspaceData.name);
      setDescription(workspaceData.description || "");
    }
  }, [workspaceData]);

  const updateWorkspace = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      const res = await apiClient.patch(`/workspaces/${workspace.id}`, data);
      return res.data as Workspace;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspace.id] });
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

  const deleteWorkspace = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/workspaces/${workspace.id}`);
    },
    onSuccess: () => {
      toast.success("Workspace deleted");
      router.push("/workspaces");
    },
    onError: () => {
      toast.error("Failed to delete workspace");
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading workspace...</div>;
  }

  return (
    <div className="space-y-8">
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

    {!workspaceData?.isPersonal && (
      <div className="rounded-lg border border-destructive/30 p-4">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete this workspace and all its data. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 rounded-lg border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            Delete Workspace
          </button>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => deleteWorkspace.mutate()}
              disabled={deleteWorkspace.isPending}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleteWorkspace.isPending ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    )}
    </div>
  );
}
