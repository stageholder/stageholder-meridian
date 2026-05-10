import { useOrg, useStageholder, useUser } from "@stageholder/sdk/react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Authenticated landing screen. This is your starting point — replace the
 * placeholder body with real Meridian product UI. The SDK hooks
 * (`useUser`, `useOrg`, `useFeature`, `useSubscription`) are the bridge
 * between Hub claims and your screens.
 *
 * The Sign out button stays here as a convenience for development; move or
 * style it to fit your product chrome later.
 */
export default function HomeScreen() {
  const { signOut } = useStageholder();
  const { user } = useUser();
  const { org } = useOrg();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>
        Welcome{user?.name ? `, ${user.name}` : ""}.
      </Text>
      <Text style={styles.org}>
        {org?.name ? `Active org: ${org.name}` : "No active organization"}
      </Text>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderTitle}>Meridian goes here</Text>
        <Text style={styles.placeholderText}>
          Auth, token refresh, secure storage, and feature gating are wired up
          via @stageholder/sdk. Add your product screens under app/(authed)/.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          signOut();
        }}
        style={({ pressed }) => [
          styles.button,
          styles.buttonDanger,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fafafa" },
  container: { padding: 24, paddingTop: 80 },
  greeting: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  org: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 32,
  },
  placeholderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 32,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 20,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDanger: { backgroundColor: "#dc2626" },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "500" },
});
