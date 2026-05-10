// apps/mobile/app/sign-in.tsx
//
// Sign-in screen. Same OIDC flow as before — restyled with @stageholder/ui
// primitives so it shares the observatory aesthetic with the rest of the app.
// One CTA, calm copy, error surface only when relevant.

import {
  useSignIn,
  useStageholder,
  SignInCancelledError,
} from "@stageholder/sdk/react-native";
import {
  Banner,
  Button,
  H1,
  Paragraph,
  Spinner,
  YStack,
} from "@stageholder/ui";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInScreen() {
  const { state } = useStageholder();
  const { signIn, isLoading, error } = useSignIn();

  if (state.status === "loading") {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  if (state.status === "authenticated") {
    return <Redirect href="/" />;
  }

  const showError = error && !(error instanceof SignInCancelledError);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} px="$6" justify="center" gap="$5">
          <YStack gap="$2">
            <Paragraph
              fontFamily="$mono"
              fontSize={11}
              letterSpacing={2.4}
              textTransform="uppercase"
              color="$color11"
            >
              Meridian
            </Paragraph>
            <H1 color="$color12" lineHeight="$11">
              Light, kept.
            </H1>
            <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
              Habits, todos, and journaling — all in one place. Track the things
              that move you forward.
            </Paragraph>
          </YStack>

          <YStack gap="$3" pt="$4">
            {/* `key` flips when disabled changes — Tamagui v2 calls a few
                hooks conditionally based on prop shape, so a same-instance
                disabled-toggle triggers "Rendered more hooks…". Forcing a
                remount via key sidesteps it. This is the workaround Tamagui
                docs recommend; see the `transition prop rules` section. */}
            <Button
              key={isLoading ? "loading" : "idle"}
              intent="primary"
              size="$5"
              disabled={isLoading}
              onPress={() => {
                signIn().catch((e) => {
                  if (e instanceof SignInCancelledError) return;
                  // Anything else surfaces via the `error` field below.
                });
              }}
            >
              {isLoading ? "Opening browser…" : "Continue with Stageholder"}
            </Button>

            {showError ? (
              <Banner intent="danger">
                <Banner.Title>Sign-in failed</Banner.Title>
                <Banner.Description>{error.message}</Banner.Description>
              </Banner>
            ) : null}
          </YStack>

          <Paragraph fontSize={11} color="$color10" text="center" pt="$8">
            Stageholder handles auth. We never see your password.
          </Paragraph>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}
