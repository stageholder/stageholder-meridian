"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import { useMemberRole } from "@/hooks/use-member-role";
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
  const myRole = useMemberRole(workspace.id);
  const isAdmin = myRole === "owner" || myRole === "admin";
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<WorkspaceMember[]>({
    queryKey: ["workspaceMembers", workspace.id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/members`);
      return res.data?.data ?? res.data;
    },
  });

  const inviteMember = useMutation({
    mutationFn: async (data: { email: string; role?: string }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/members/invite`,
        data,
      );
      return res.data as WorkspaceMember;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ["workspaceMembers", workspace.id],
      });
      if (data.inviteLink) {
        setLastInviteLink(data.inviteLink);
      }
      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: () => {
      toast.error("Failed to send invitation");
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/members/${memberId}`,
        { role },
      );
      return res.data as WorkspaceMember;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspaceMembers", workspace.id],
      });
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
      void queryClient.invalidateQueries({
        queryKey: ["workspaceMembers", workspace.id],
      });
      toast.success("Member removed");
    },
    onError: () => {
      toast.error("Failed to remove member");
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/members/resend/${memberId}`,
      );
      return res.data as WorkspaceMember;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ["workspaceMembers", workspace.id],
      });
      if (data.inviteLink) {
        setLastInviteLink(data.inviteLink);
      }
      toast.success("Invitation resent");
    },
    onError: () => {
      toast.error("Failed to resend invitation");
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiClient.post(
        `/workspaces/${workspace.id}/members/cancel/${memberId}`,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspaceMembers", workspace.id],
      });
      toast.success("Invitation cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel invitation");
    },
  });

  const leaveWorkspace = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/workspaces/${workspace.id}/members/leave`);
    },
    onSuccess: () => {
      toast.success("You have left the workspace");
      window.location.href = "/workspaces";
    },
    onError: () => {
      toast.error("Failed to leave workspace");
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setLastInviteLink(null);
    inviteMember.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  }

  function copyInviteLink() {
    if (!lastInviteLink) return;
    navigator.clipboard.writeText(lastInviteLink).then(() => {
      toast.success("Invite link copied to clipboard");
    });
  }

  return (
    <div className="space-y-6">
      {/* Invite Form — only for owner/admin */}
      {isAdmin && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Invite Member
          </h3>
          <form onSubmit={handleInvite} className="mt-3 flex items-end gap-3">
            <div className="flex-1 max-w-sm">
              <label
                htmlFor="invite-email"
                className="block text-sm font-medium text-foreground"
              >
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
              <label
                htmlFor="invite-role"
                className="block text-sm font-medium text-foreground"
              >
                Role
              </label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1 rounded-lg border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
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

          {/* Invite Link */}
          {lastInviteLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {lastInviteLink}
              </span>
              <button
                type="button"
                onClick={copyInviteLink}
                className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
      )}

      {/* Members Table */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Members</h3>
          {myRole && myRole !== "owner" && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to leave this workspace?",
                  )
                ) {
                  leaveWorkspace.mutate();
                }
              }}
              disabled={leaveWorkspace.isPending}
              className="text-xs text-destructive hover:underline"
            >
              {leaveWorkspace.isPending ? "Leaving..." : "Leave Workspace"}
            </button>
          )}
        </div>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Loading members...
          </p>
        ) : members && members.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-foreground">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: WorkspaceMember) => (
                  <tr
                    key={member.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-foreground">
                      {member.email}
                    </td>
                    <td className="px-4 py-3">
                      {member.role === "owner" ? (
                        <span className="text-xs font-medium text-foreground">
                          Owner
                        </span>
                      ) : isAdmin ? (
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
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs capitalize text-foreground">
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${
                          member.invitationStatus === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {member.invitationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.invitationStatus === "pending" && isAdmin && (
                          <>
                            <button
                              onClick={() => resendInvitation.mutate(member.id)}
                              disabled={resendInvitation.isPending}
                              className="text-xs text-primary hover:underline"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm("Cancel this invitation?")) {
                                  cancelInvitation.mutate(member.id);
                                }
                              }}
                              disabled={cancelInvitation.isPending}
                              className="text-xs text-destructive hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {member.role !== "owner" &&
                          isAdmin &&
                          member.invitationStatus === "accepted" && (
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
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No members yet. Invite someone above.
          </p>
        )}
      </div>
    </div>
  );
}
