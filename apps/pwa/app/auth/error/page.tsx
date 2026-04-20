import { AuthShell } from "@/components/shared/auth-shell";

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  state_mismatch: "Sign-in request expired or was tampered with.",
  missing_params: "Sign-in response was incomplete.",
  token_exchange_failed:
    "Could not complete sign-in with the identity service.",
  invalid_id_token: "Received an invalid ID token.",
  access_denied: "You did not grant access to Meridian.",
};

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const message = (reason && REASONS[reason]) || "Sign-in failed.";

  return (
    <AuthShell>
      {/* Icon: alert triangle, uses the shake animation to reinforce error */}
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

      {/* Copy */}
      <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
        >
          Sign-in failed
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {message}
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
          Try again
        </a>
      </div>
    </AuthShell>
  );
}
