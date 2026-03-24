"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { setLoggedInFlag } from "@/lib/auth-helpers";
import { useAuthStore } from "@/stores/auth-store";
import { GoogleSignInButton } from "@/components/shared/google-sign-in-button";
import type { AuthUser } from "@repo/core/types";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const setUser = useAuthStore((s) => s.setUser);
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
      const res = await apiClient.post<AuthUser>("/auth/login", {
        email,
        password,
      });
      setUser(res.data);
      setLoggedInFlag();
      if (redirect) {
        router.push(redirect);
      } else if (!res.data.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push(
          res.data.personalWorkspaceShortId
            ? `/${res.data.personalWorkspaceShortId}/dashboard`
            : "/workspaces",
        );
      }
    } catch {
      setError("Invalid email or password. Please try again.");
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
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to continue your journey
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`mt-8 space-y-5 ${shake ? "auth-error" : ""}`}
      >
        <div className="auth-animate auth-stagger-2">
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

        <div className="auth-animate auth-stagger-3">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </div>

        <div className="auth-animate auth-stagger-5 relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground tracking-wider">
              or
            </span>
          </div>
        </div>

        <div className="auth-animate auth-stagger-6">
          <GoogleSignInButton />
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground auth-animate auth-stagger-7">
        Don&apos;t have an account?{" "}
        <Link
          href={
            redirect
              ? `/register?redirect=${encodeURIComponent(redirect)}`
              : "/register"
          }
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
