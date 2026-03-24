"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { setLoggedInFlag } from "@/lib/auth-helpers";
import { useAuthStore } from "@/stores/auth-store";
import { GoogleSignInButton } from "@/components/shared/google-sign-in-button";
import type { AuthUser } from "@repo/core/types";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiClient.post<AuthUser>("/auth/register", {
        name,
        email,
        password,
      });
      setUser(res.data);
      setLoggedInFlag();
      if (redirect) {
        router.push(redirect);
      } else {
        router.push(
          res.data.onboardingCompleted
            ? `/${res.data.personalWorkspaceShortId}/dashboard`
            : "/onboarding",
        );
      }
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (
              err as {
                response?: { status?: number; data?: { message?: string } };
              }
            ).response?.status
          : undefined;
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;

      if (status === 409 || message?.toLowerCase().includes("already")) {
        setError(
          "An account with this email already exists. Please sign in instead.",
        );
      } else {
        setError(message || "Registration failed. Please try again.");
      }
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="auth-animate auth-stagger-1">
        <h2 className="text-2xl font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground">
          Start your journey
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Create an account to begin building better habits
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`mt-8 space-y-5 ${shake ? "auth-error" : ""}`}
      >
        <div className="auth-animate auth-stagger-2">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="auth-animate auth-stagger-3">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="auth-animate auth-stagger-4">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Password
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
          <p className="mt-1.5 text-xs text-muted-foreground">
            Must be at least 8 characters
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive auth-animate auth-stagger-1">
            {error}
          </p>
        )}

        <div className="auth-animate auth-stagger-5">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Creating account...
              </span>
            ) : (
              "Create account"
            )}
          </button>
        </div>

        <div className="auth-animate auth-stagger-6 relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground tracking-wider">
              or
            </span>
          </div>
        </div>

        <div className="auth-animate auth-stagger-7">
          <GoogleSignInButton />
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground auth-animate auth-stagger-8">
        Already have an account?{" "}
        <Link
          href={
            redirect
              ? `/login?redirect=${encodeURIComponent(redirect)}`
              : "/login"
          }
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
