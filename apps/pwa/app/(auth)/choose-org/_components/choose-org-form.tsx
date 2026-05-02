"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrgMembership } from "@stageholder/sdk/core";
import { OrbitIllustration } from "@/components/billing/orbit-illustration";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Loader2 } from "lucide-react";

/**
 * Editorial multi-org picker. Mirrors the typographic system used on the
 * billing redesign — Bricolage display, Geist Mono labels, hairline rules,
 * orbital illustration — so first-login feels like opening a chapter of
 * the same book.
 *
 * On submit:
 *   1. POST `/auth/switch-org` with the chosen `orgId` and the CSRF header.
 *   2. On success, full-page-navigate to `returnTo` so the
 *      StageholderProvider re-fetches `/auth/me` cleanly with the new
 *      activeOrgId baked into the session.
 */
export function ChooseOrgForm({
  organizations,
  activeOrgId,
  csrfToken,
  returnTo,
  userName,
}: {
  organizations: OrgMembership[];
  activeOrgId: string | undefined;
  csrfToken: string;
  returnTo: string;
  userName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(
    activeOrgId ?? organizations[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function submit(): void {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/auth/switch-org", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-stageholder-csrf": csrfToken,
          },
          body: JSON.stringify({ orgId: selected }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `switch failed: ${res.status}`);
        }
        // Full-page navigate so the provider state flushes — pushing via
        // router.push() would reuse the in-memory provider context whose
        // `state.data.activeOrgId` is now stale.
        window.location.assign(returnTo);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't switch organization.",
        );
      }
    });
  }

  return (
    <main className="billing-paper relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 md:py-14">
        {/* Top bar */}
        <div className="auth-animate auth-stagger-1 mb-12 flex items-center justify-between">
          <span
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Meridian
          </span>
        </div>

        <div className="grid flex-1 items-start gap-12 md:grid-cols-[1.4fr_1fr]">
          {/* Left — heading + list */}
          <section>
            <header className="auth-animate auth-stagger-2 mb-10 space-y-4">
              <p className="text-sm font-medium text-foreground/60">
                Welcome back{userName ? `, ${firstName(userName)}` : ""}
              </p>
              <h1
                className="text-[clamp(2.5rem,6vw,4rem)] leading-[0.95] tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Choose your organization
              </h1>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                You&rsquo;re a member of {organizations.length} organizations.
                Pick one to continue — you can switch at any time from your
                account menu.
              </p>
            </header>

            <ul
              className="auth-animate auth-stagger-3 space-y-2"
              role="radiogroup"
              aria-label="Organizations"
            >
              {organizations.map((org, i) => {
                const isSelected = selected === org.id;
                const isCurrent = activeOrgId === org.id;
                return (
                  <li key={org.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelected(org.id)}
                      className={cn(
                        "group/row relative flex w-full items-center gap-4 rounded-2xl border bg-card/85 px-5 py-4 text-left",
                        "transition-all duration-200",
                        "hover:border-foreground/40 hover:bg-card",
                        isSelected
                          ? "border-foreground/70 shadow-[0_18px_40px_-30px_color-mix(in_oklch,var(--foreground)_30%,transparent)]"
                          : "border-border/70",
                      )}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span
                            className="text-lg leading-none tracking-tight"
                            style={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 600,
                            }}
                          >
                            {org.name}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                              Last used
                            </span>
                          )}
                        </div>
                        <p className="text-sm capitalize text-muted-foreground">
                          {org.role}
                        </p>
                      </div>

                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border/80 text-transparent group-hover/row:border-foreground/40",
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p
                role="alert"
                className="auth-animate auth-error mt-5 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="auth-animate auth-stagger-4 mt-10 space-y-3">
              <button
                type="button"
                onClick={submit}
                disabled={pending || !selected}
                className={cn(
                  "group/btn flex h-12 w-full items-center justify-between gap-2 rounded-full bg-foreground pl-6 pr-1.5 text-sm font-medium text-background",
                  "transition-opacity hover:opacity-90",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <span>
                  {pending ? "Loading your organization…" : "Continue"}
                </span>
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-background/15 transition-transform group-hover/btn:translate-x-0.5">
                  {pending ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      strokeWidth={2}
                    />
                  ) : (
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/auth/logout")}
                className="block w-full rounded-full px-5 py-2 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </section>

          {/* Right — orbital diagram, framed like the billing surfaces */}
          <aside className="auth-animate auth-stagger-3 hidden md:block">
            <div className="relative mx-auto aspect-square w-full max-w-[300px]">
              <div className="absolute inset-0 rounded-[28px] bg-background/60 ring-1 ring-border/70" />
              <div className="absolute inset-0 p-6">
                <OrbitIllustration tier="conduct" />
              </div>
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <CornerTick key={c} corner={c} />
              ))}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="auth-animate auth-stagger-5 mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-6">
          <p className="text-xs text-muted-foreground">
            Meridian — personal productivity
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by Stageholder
          </p>
        </footer>
      </div>
    </main>
  );
}

function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos: Record<typeof corner, string> = {
    tl: "top-2 left-2",
    tr: "top-2 right-2",
    bl: "bottom-2 left-2",
    br: "bottom-2 right-2",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "absolute size-3",
        pos[corner],
        "before:absolute before:inset-0 before:border-foreground/30",
        corner === "tl" && "before:border-l before:border-t",
        corner === "tr" && "before:border-r before:border-t",
        corner === "bl" && "before:border-l before:border-b",
        corner === "br" && "before:border-r before:border-b",
      )}
    />
  );
}

function firstName(s: string): string {
  if (s.includes("@")) return s.split("@")[0]!;
  return s.split(/\s+/)[0] ?? s;
}
