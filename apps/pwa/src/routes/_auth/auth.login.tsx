import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSignIn } from "@stageholder/sdk/spa";
import { H1, Paragraph, Text, YStack } from "@stageholder/ui";

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
