import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, H1, Paragraph, YStack } from "@stageholder/ui";

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
    <YStack minH={"100vh" as never} items="center" justify="center" px="$6">
      <YStack maxW={448} items="center">
        <H1 fontSize="$7" fontWeight="600" letterSpacing={-0.5} text="center">
          Sign-in failed
        </H1>
        <Paragraph mt="$3" fontSize="$3" color="$mutedForeground" text="center">
          {message}
        </Paragraph>
        <Link
          to="/auth/login"
          style={{ textDecoration: "none", marginTop: 24 }}
        >
          <Button>Try again</Button>
        </Link>
      </YStack>
    </YStack>
  );
}
