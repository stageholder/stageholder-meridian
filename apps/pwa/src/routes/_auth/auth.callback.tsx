import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useHandleCallback, useUser } from "@stageholder/sdk/spa";
import { YStack, Text } from "@stageholder/ui";

export const Route = createFileRoute("/_auth/auth/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  // The SDK's StageholderSpaProvider runs the OIDC exchange in its
  // cold-start effect; useHandleCallback is a pure observer of that state.
  // After success the provider calls window.history.replaceState with the
  // stored returnTo URL — we just need to wait until `user` lands, then
  // navigate into the app.
  const { isLoading, error } = useHandleCallback();
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isLoading && !error) {
      navigate({ to: "/" });
    }
  }, [user, isLoading, error, navigate]);

  useEffect(() => {
    if (!error) return;
    // Surface the actual error before redirecting to the generic error
    // page — devtools is the only way to read what really failed
    // (CSRF mismatch, network error from Hub, wrong client_id, etc.).
    // The /auth/error page only knows the reason code, not the cause.
    console.error("[meridian:auth] callback failed:", {
      name: error.name,
      message: error.message,
      cause: (error as Error & { cause?: unknown }).cause,
      stack: error.stack,
    });
    // Pick a more specific reason when we can identify the error class.
    const msg = error.message ?? "";
    const reason =
      error.name === "CsrfError" || msg.toLowerCase().includes("state")
        ? "state_mismatch"
        : msg.toLowerCase().includes("missing")
          ? "missing_params"
          : "token_exchange_failed";
    navigate({ to: "/auth/error", search: { reason } });
  }, [error, navigate]);

  return (
    <YStack minH={"100vh" as never} items="center" justify="center">
      <Text fontSize="$3" color="$mutedForeground">
        Completing sign-in…
      </Text>
    </YStack>
  );
}
