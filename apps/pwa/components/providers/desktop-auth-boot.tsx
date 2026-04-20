"use client";

/**
 * Desktop-only auth gate. On web it renders children immediately (no-op).
 * On Tauri desktop it tries a silent refresh on boot; if no refresh token
 * is stored, it renders a branded sign-in screen that kicks off the PKCE
 * flow via `signInTauri()`. After a successful sign-in we redirect to
 * `/app`. The sign-in / loading / error surfaces are all wrapped in
 * AuthShell so Meridian's brand identity carries through even though the
 * actual credential prompt lives on the Hub (opened in the system browser).
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { detectPlatform } from "@repo/core/platform";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/shared/auth-shell";
import { MeridianLogo } from "@/components/shared/meridian-logo";

type BootState =
  | "checking"
  | "signed-in"
  | "signed-out"
  | "signing-in"
  | "error";

export function DesktopAuthBoot({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<BootState>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (detectPlatform() !== "desktop") {
      setState("signed-in");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getSessionTauri } = await import("@/lib/oidc-tauri");
        const session = await getSessionTauri();
        if (cancelled) return;
        if (session) {
          setState("signed-in");
          if (pathname === "/" || pathname.startsWith("/auth")) {
            router.replace("/app");
          }
        } else {
          setState("signed-out");
        }
      } catch {
        if (!cancelled) setState("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (state === "checking") {
    return (
      <AuthShell>
        <div className="auth-animate auth-stagger-1">
          <MeridianLogo size="lg" />
        </div>
        <div className="auth-animate auth-stagger-2 mt-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AuthShell>
    );
  }

  if (state === "signed-out") {
    return (
      <AuthShell>
        <div className="auth-animate auth-stagger-1">
          <MeridianLogo size="lg" />
        </div>

        <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
          <h1
            className="text-2xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
          >
            Welcome to Meridian
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Sign in with your Stageholder account to pick up where you left off.
          </p>
        </div>

        <div className="auth-animate auth-stagger-3 mt-6 flex items-center gap-3">
          <Button
            size="lg"
            onClick={async () => {
              setState("signing-in");
              try {
                const { signInTauri } = await import("@/lib/oidc-tauri");
                await signInTauri();
                setState("signed-in");
                router.replace("/app");
              } catch (err) {
                setErrorMsg(
                  err instanceof Error ? err.message : "Sign-in failed",
                );
                setState("error");
              }
            }}
          >
            Sign in with Stageholder
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (state === "signing-in") {
    return (
      <AuthShell>
        <div className="auth-animate auth-stagger-1">
          <MeridianLogo size="lg" />
        </div>
        <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
          <h1
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
          >
            Opening your browser
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Complete sign-in in the browser window that just opened. You can
            return here when you&rsquo;re done.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (state === "error") {
    return (
      <AuthShell>
        <div className="auth-animate auth-stagger-1 auth-error flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/40 bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-destructive"
            aria-hidden
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
          <h1
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
          >
            Sign-in failed
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {errorMsg ?? "Something went wrong. Please try again."}
          </p>
        </div>
        <div className="auth-animate auth-stagger-3 mt-6">
          <Button onClick={() => setState("signed-out")}>Try again</Button>
        </div>
      </AuthShell>
    );
  }

  return <>{children}</>;
}
