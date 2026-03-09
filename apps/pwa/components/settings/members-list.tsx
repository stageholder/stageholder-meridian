"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import type { WorkspaceMember } from "@repo/core/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MembersList() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: members, isLoading } = useQuery<WorkspaceMember[]>({
    queryKey: ["workspaceMembers", workspace.id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/members`);
      return res.data;
    },
  });

  const inviteMember = useMutation({
    mutationFn: async (data: { email: string; role?: string }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/members/invite`,
        data
      );
      return res.data as WorkspaceMember;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaceMembers", workspace.id] });
      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: () => {
      toast.error("Failed to send invitation");
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/members/${memberId}`,
        { role }
      );
      return res.data as WorkspaceMember;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaceMembers", workspace.id] });
      toast.success("Role updated");
    },
    onError: () => {
      toast.error("Failed to update role");
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/members/${memberId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaceMembers", workspace.id] });
      toast.success("Member removed");
    },
    onError: () => {
      toast.error("Failed to remove member");
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    inviteMember.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  }

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Invite Member</h3>
        <form onSubmit={handleInvite} className="mt-3 flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="mt-1 rounded-lg border-border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="submit"
            disabled={!inviteEmail.trim() || inviteMember.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviteMember.isPending ? "Sending..." : "Invite"}
          </button>
        </form>
      </div>

      {/* Members Table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Members</h3>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading members...</p>
        ) : members && members.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-foreground">Email</th>
                  <th className="px-4 py-2 text-left font-medium text-foreground">Role</th>
                  <th className="px-4 py-2 text-left font-medium text-foreground">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: WorkspaceMember) => (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{member.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateRole.mutate({
                            memberId: member.id,
                            role,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 rounded border-border bg-background px-2 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs capitalize text-accent-foreground">
                        {member.invitationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm("Remove this member?")) {
                            removeMember.mutate(member.id);
                          }
                        }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No members yet. Invite someone above.</p>
        )}
      </div>
    </div>
  );
}
