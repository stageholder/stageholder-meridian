import { AuthShell } from "@/components/shared/auth-shell";

export const dynamic = "force-static";

export default function GoodbyePage() {
  return (
    <AuthShell>
      {/* Icon: wave / farewell */}
      <div className="auth-animate auth-stagger-1 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
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
          className="text-primary"
          aria-hidden
        >
          <path d="M9 11V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v4" />
          <path d="M5 11V9a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v2" />
          <path d="M13 11V8a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v3" />
          <path d="M17 11V9.5a1.5 1.5 0 0 1 3 0V17a6 6 0 0 1-6 6h-2.5A6.5 6.5 0 0 1 5 16.5V14" />
        </svg>
      </div>

      {/* Copy */}
      <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
        >
          Signed out
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          You&rsquo;ve been signed out of Meridian. See you next time.
        </p>
      </div>

      {/* Action */}
      <div className="auth-animate auth-stagger-3 mt-6 flex items-center gap-3">
        {/* Plain <a> — /auth/login redirects cross-origin to the Hub.
            Next.js's <Link> would attempt client-side RSC nav which
            trips CORS on that cross-origin hop. Top-level nav is fine. */}
        <a
          href="/auth/login"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Sign in again
        </a>
      </div>
    </AuthShell>
  );
}
