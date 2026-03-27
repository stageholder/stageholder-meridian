"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, AlertCircle, Clock, ArrowLeft } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { MeridianLogo } from "@/components/auth/meridian-logo";
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2 mb-8 auth-animate auth-stagger-1">
          <MeridianLogo size="md" />
          <h1 className="text-xl font-[family-name:var(--font-display)] tracking-tight font-semibold text-foreground">
            Meridian
          </h1>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-4 auth-animate auth-stagger-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <p className="text-sm text-muted-foreground">
              Loading invitation...
            </p>
          </div>
        )}

        {notFound && (
          <div className="rounded-xl border border-border bg-card p-8 text-center auth-animate auth-stagger-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Invitation not found
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This invitation link is invalid or has already been used.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to sign in
            </Link>
          </div>
        )}

        {info?.expired && (
          <div className="rounded-xl border border-border bg-card p-8 text-center auth-animate auth-stagger-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ring-habit/10 mb-4">
              <Clock className="h-6 w-6 text-ring-habit" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Invitation expired
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This invitation has expired. Please ask the workspace admin to
              send a new one.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to sign in
            </Link>
          </div>
        )}

        {info && !info.expired && (
          <div className="rounded-xl border border-border bg-card p-8 auth-animate auth-stagger-2">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
                <Users className="h-7 w-7 text-primary" />
              </div>

              <h2 className="text-xl font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground">
                You&apos;re invited
              </h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                You&apos;ve been invited to join{" "}
                <span className="font-semibold text-foreground">
                  {info.workspaceName}
                </span>{" "}
                as a{" "}
                <span className="font-semibold text-foreground">
                  {info.role}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{info.email}</p>
            </div>

            {error && (
              <p className="mt-4 text-sm text-destructive text-center">
                {error}
              </p>
            )}

            <div className="mt-8">
              {isAuthenticated && user ? (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {accepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      Accepting...
                    </span>
                  ) : (
                    "Accept invitation"
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() =>
                      router.push(`/login?redirect=/invite/${token}`)
                    }
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background transition-all active:scale-[0.98]"
                  >
                    Sign in to accept
                  </button>
                  <button
                    onClick={() =>
                      router.push(`/register?redirect=/invite/${token}`)
                    }
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-all active:scale-[0.98]"
                  >
                    Create an account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
