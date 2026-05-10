// apps/mobile/app/(authed)/profile.tsx
//
// Profile tab — user/org info from the SDK + sign-out. Settings (notifications,
// theme switch, brand picker, billing portal) will land here over time.

import { useOrg, useStageholder, useUser } from "@stageholder/sdk/react-native";
import {
  Avatar,
  Button,
  Card,
  H3,
  List,
  Paragraph,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { signOut } = useStageholder();
  const { user } = useUser();
  const { org } = useOrg();

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "?";

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
        >
          <YStack gap="$5" pt="$4">
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
              >
                Profile · settings
              </Paragraph>
              <H3 color="$color12">You</H3>
            </YStack>

            {/* ---- Identity card ---- */}
            <Card>
              <Card.Body gap="$3">
                <XStack items="center" gap="$3">
                  <Avatar circular size="$5">
                    <Avatar.Fallback
                      bg="$color5"
                      items="center"
                      justify="center"
                    >
                      <Text fontSize="$5" fontWeight="700" color="$color12">
                        {initials}
                      </Text>
                    </Avatar.Fallback>
                  </Avatar>
                  <YStack flex={1} gap={2}>
                    <Text fontSize="$4" fontWeight="600" color="$color12">
                      {user?.name ?? "Unknown"}
                    </Text>
                    <Paragraph fontSize="$2" color="$color11" numberOfLines={1}>
                      {user?.email ?? "—"}
                    </Paragraph>
                  </YStack>
                </XStack>
              </Card.Body>
            </Card>

            {/* ---- Active org / details list ---- */}
            <Card>
              <Card.Header>
                <Text
                  fontFamily="$mono"
                  fontSize={10}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                >
                  Account
                </Text>
              </Card.Header>
              <Card.Body p={0}>
                {/* List.Item is a flex row; List.Group stacks Title + Description
                    inside it. Putting them as siblings of Item (not nested as
                    Item.Title/Item.Subtitle) is the correct compound-component
                    shape — see @stageholder/ui's List source. */}
                <List>
                  <List.Item>
                    <List.Group>
                      <List.Title>Organization</List.Title>
                      <List.Description>
                        {org?.name ?? "No active organization"}
                      </List.Description>
                    </List.Group>
                  </List.Item>
                  <List.Item>
                    <List.Group>
                      <List.Title>User ID</List.Title>
                      <List.Description>{user?.sub ?? "—"}</List.Description>
                    </List.Group>
                  </List.Item>
                </List>
              </Card.Body>
            </Card>

            {/* ---- Sign out ---- */}
            <Button intent="destructive" onPress={signOut}>
              Sign out
            </Button>

            <Paragraph fontSize="$1" color="$color10" text="center">
              Settings (notifications, theme, billing) coming soon.
            </Paragraph>
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
