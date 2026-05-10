import {
  useSignIn,
  useStageholder,
  SignInCancelledError,
} from "@stageholder/sdk/react-native";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SignInScreen() {
  const { state } = useStageholder();
  const { signIn, isLoading, error } = useSignIn();

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.status === "authenticated") {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meridian</Text>
      <Text style={styles.subtitle}>Sign in with your Stageholder account</Text>

      <Pressable
        accessibilityRole="button"
        disabled={isLoading}
        onPress={() => {
          // Swallow user cancellation — leaving the screen mounted is the
          // right UX. Surface anything else.
          signIn().catch((e) => {
            if (e instanceof SignInCancelledError) return;
            // Other errors land on `error` via the hook; nothing to do.
          });
        }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Opening browser…" : "Continue with Stageholder"}
        </Text>
      </Pressable>

      {error && !(error instanceof SignInCancelledError) ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Sign-in failed</Text>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#fafafa",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 32,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "500" },
  errorBox: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: { fontWeight: "600", color: "#991b1b", marginBottom: 4 },
  errorText: { color: "#991b1b", fontSize: 13 },
});
