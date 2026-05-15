import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSignIn } from "@stageholder/sdk/spa";

export const Route = createFileRoute("/_auth/auth/login")({
  validateSearch: (s): { returnTo?: string } => ({
    returnTo: typeof s.returnTo === "string" ? s.returnTo : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const { signIn, isLoading, error } = useSignIn();

  useEffect(() => {
    void signIn({ returnTo: returnTo ?? "/" });
  }, [signIn, returnTo]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Sign-in failed to start</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      {isLoading ? "Redirecting to sign-in…" : "Preparing sign-in…"}
    </div>
  );
}
