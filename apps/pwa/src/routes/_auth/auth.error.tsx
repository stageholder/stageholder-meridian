import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@stageholder/ui";

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
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign-in failed</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Button tag="a" href="/auth/login" className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
