"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import apiClient from "@/lib/api-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <div className="auth-animate auth-stagger-1">
          <h2 className="text-2xl font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground">
            Invalid reset link
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <div className="auth-animate auth-stagger-2 mt-6">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="auth-animate auth-stagger-1">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
        </div>
        <div className="auth-animate auth-stagger-2 mt-6">
          <h2 className="text-2xl font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground">
            Password reset
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been updated. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="auth-animate auth-stagger-1">
        <h2 className="text-2xl font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground">
          Set new password
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="auth-animate auth-stagger-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="auth-animate auth-stagger-3">
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Enter password again"
            className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive auth-animate auth-stagger-1">
            {error}
          </p>
        )}

        <div className="auth-animate auth-stagger-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Resetting...
              </span>
            ) : (
              "Reset password"
            )}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center auth-animate auth-stagger-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
