import { useStageholder } from "@stageholder/sdk/react-native";
import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";

/**
 * Auth gate — every screen under `app/(authed)/` redirects to /sign-in
 * unless the SDK reports an authenticated session.
 *
 * Add product screens by dropping new route files alongside `index.tsx`.
 */
export default function AuthedLayout() {
  const { state } = useStageholder();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.status === "unauthenticated" || state.status === "error") {
    return <Redirect href="/sign-in" />;
  }
  return <Slot />;
}
