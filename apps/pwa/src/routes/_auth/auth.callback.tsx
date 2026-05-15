import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useHandleCallback, useUser } from "@stageholder/sdk/spa";

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
    if (error) {
      navigate({
        to: "/auth/error",
        search: { reason: "token_exchange_failed" },
      });
    }
  }, [error, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Completing sign-in…
    </div>
  );
}
