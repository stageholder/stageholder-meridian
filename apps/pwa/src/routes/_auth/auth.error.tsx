import { createFileRoute } from "@tanstack/react-router";

const REASONS: Record<string, string> = {
  state_mismatch: "Sign-in request expired or was tampered with.",
  missing_params: "Sign-in response was incomplete.",
  token_exchange_failed:
    "Could not complete sign-in with the identity service.",
  invalid_id_token: "Received an invalid ID token.",
  access_denied: "You did not grant access to Meridian.",
};

export const Route = createFileRoute("/_auth/auth/error")({
  validateSearch: (s): { reason?: string; from?: string } => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: AuthErrorPage,
});

// AuthShell + the styled illustration land in Phase 3 once
// components/shared/auth-shell.tsx moves into src/. For now, render a
// plain shell so the route is reachable end-to-end.
function AuthErrorPage() {
  const { reason, from } = Route.useSearch();
  const base = (reason && REASONS[reason]) || "Sign-in failed.";
  const message = from ? `${base} (last attempt: ${from})` : base;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign-in failed</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <a
          href="/auth/login"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
