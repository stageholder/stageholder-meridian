import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, ArrowRight } from "lucide-react";
import {
  Button,
  H1,
  Paragraph,
  SizableText,
  Tabs,
  View,
  YStack,
} from "@stageholder/ui";
import { ProfileForm } from "@/components/settings/profile-form";
import { TargetsSettings } from "@/components/settings/targets-settings";

const HUB_URL = import.meta.env.VITE_HUB_URL ?? "https://id.stageholder.com";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "targets", label: "Targets" },
  { id: "account", label: "Account" },
] as const;

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();

  return (
    <YStack gap="$6" p="$4">
      <YStack>
        <H1 fontSize="$8" fontWeight="700" color="$color">
          Settings
        </H1>
        <Paragraph mt="$0.5" fontSize="$3" color="$mutedForeground">
          Manage your profile and preferences.
        </Paragraph>
      </YStack>

      {/* Tabs — `variant="underline"` matches the page-level navigation
          pattern (Linear / Notion / GitHub style) the previous custom
          button row was emulating. Kit's pill variant is for dense
          contained UIs, not page-level chrome. */}
      <Tabs defaultValue="profile" orientation="horizontal" variant="underline">
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.id} value={tab.id}>
              <SizableText>{tab.label}</SizableText>
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <View maxW={672}>
          <Tabs.Content value="profile">
            <ProfileForm />
          </Tabs.Content>
          <Tabs.Content value="targets">
            <TargetsSettings />
          </Tabs.Content>
          <Tabs.Content value="account">
            <YStack gap="$4">
              <Paragraph fontSize="$3" color="$mutedForeground">
                Your billing and subscription live in-app. Password, MFA,
                connected accounts, sessions, and account deletion are managed
                on Stageholder.
              </Paragraph>
              <YStack gap="$2">
                <Button
                  intent="outline"
                  iconAfter={<ArrowRight size={14} opacity={0.7} />}
                  onPress={() => void navigate({ to: "/settings/billing" })}
                >
                  Billing &amp; subscription
                </Button>
                <Button
                  iconAfter={<ArrowRight size={14} opacity={0.7} />}
                  onPress={() =>
                    void navigate({ to: "/settings/billing/upgrade" })
                  }
                >
                  Upgrade plan
                </Button>
                <a
                  href={`${HUB_URL}/account`}
                  target="_blank"
                  rel="noopener"
                  style={{ textDecoration: "none" }}
                >
                  <Button
                    intent="outline"
                    iconAfter={<ExternalLink size={14} opacity={0.7} />}
                  >
                    Security &amp; sign-in on Stageholder
                  </Button>
                </a>
              </YStack>
            </YStack>
          </Tabs.Content>
        </View>
      </Tabs>
    </YStack>
  );
}
