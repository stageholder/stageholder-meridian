import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSignIn } from "@stageholder/sdk/spa";
import { H1, Paragraph, Text, YStack } from "@stageholder/ui";
import { usesSystemBrowserAuth } from "@/lib/desktop-auth";
import { DesktopSignIn } from "@/components/auth/desktop-sign-in";

export const Route = createFileRoute("/_auth/auth/login")({
  validateSearch: (s): { returnTo?: string } => ({
    returnTo: safeReturnTo(s.returnTo),
  }),
  // Desktop never auto-starts sign-in: each launch while signed out would
  // otherwise throw the user into their browser unprompted.
  component: () => (usesSystemBrowserAuth ? <DesktopLogin /> : <LoginPage />),
});

function DesktopLogin() {
  const { returnTo } = Route.useSearch();
  return <DesktopSignIn returnTo={returnTo ?? "/"} />;
}

/**
 * Only same-origin app paths. A cross-origin (or protocol-relative `//host`)
 * value used to reach the SDK, whose post-callback `history.replaceState`
 * throws a SecurityError AFTER a successful sign-in → the signed-in user was
 * bounced to /auth/error. Anything else falls back to "/".
 */
function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return undefined;
  }
  return value;
}

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const { signIn, isLoading, error } = useSignIn();

  useEffect(() => {
    void signIn({ returnTo: returnTo ?? "/" });
  }, [signIn, returnTo]);

  if (error) {
    return (
      <YStack minH={"100vh" as never} items="center" justify="center" px="$6">
        <YStack maxW={448} items="center">
          <H1 fontSize="$6" fontWeight="600" text="center">
            Sign-in failed to start
          </H1>
          <Paragraph
            mt="$1"
            fontSize="$3"
            color="$mutedForeground"
            text="center"
          >
            {error.message}
          </Paragraph>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack minH={"100vh" as never} items="center" justify="center">
      <Text fontSize="$3" color="$mutedForeground">
        {isLoading ? "Redirecting to sign-in…" : "Preparing sign-in…"}
      </Text>
    </YStack>
  );
}
