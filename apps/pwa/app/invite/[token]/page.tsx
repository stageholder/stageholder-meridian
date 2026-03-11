"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { InvitationInfo } from "@repo/core/types";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiClient
      .get(`/invitations/${token}`)
      .then((res) => setInfo(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setError("");
    setAccepting(true);
    try {
      const res = await apiClient.post(`/invitations/${token}/accept`);
      const { workspaceShortId } = res.data;
      router.push(`/${workspaceShortId}/dashboard`);
    } catch {
      setError("Failed to accept invitation. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Invitation Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation link is invalid or has already been used.
          </p>
        </div>
      </div>
    );
  }

  if (info?.expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Invitation Expired
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation has expired. Please ask the workspace admin to send
            a new invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <h1 className="text-lg font-semibold text-foreground">
          Workspace Invitation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You have been invited to join{" "}
          <span className="font-medium text-foreground">
            {info?.workspaceName}
          </span>{" "}
          as a <span className="font-medium text-foreground">{info?.role}</span>
          .
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Invited email: {info?.email}
        </p>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {isAuthenticated && user ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {accepting ? "Accepting..." : "Accept Invitation"}
          </button>
        ) : (
          <button
            onClick={() => router.push(`/login?redirect=/invite/${token}`)}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in to Accept
          </button>
        )}
      </div>
    </div>
  );
}
