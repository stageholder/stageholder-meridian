import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ExternalLink,
  ArrowRight,
  User,
  Target,
  CreditCard,
} from "lucide-react";
import {
  Button,
  H1,
  Paragraph,
  SizableText,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from "@stageholder/ui";
import { ProfileForm } from "@/components/settings/profile-form";
import { TargetsSettings } from "@/components/settings/targets-settings";

const HUB_URL = import.meta.env.VITE_HUB_URL ?? "https://id.stageholder.com";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "targets", label: "Targets", icon: Target },
  { id: "account", label: "Account", icon: CreditCard },
] as const;

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsPage,
});

// Strip the kit Tabs.Content default card (bg/border/padding/margin) so the
// panel reads flat — the section components own their own spacing.
const FLAT_CONTENT = {
  bg: "transparent",
  borderWidth: 0,
  p: 0,
  mt: 0,
} as const;

function SettingsPage() {
  const navigate = useNavigate();
  const isDesktop = useMedia().md;

  return (
    // Centered, width-capped column (Stripe / Linear settings pattern) so the
    // page doesn't pin to the left edge on wide screens.
    <YStack gap="$6" p="$4" width="100%" maxW={920} mx="auto">
      <H1 fontSize="$8" fontWeight="700" color="$color">
        Settings
      </H1>

      {/* Vertical nav rail beside the active panel on desktop; a horizontal
          tab bar on narrow / mobile. Kit Tabs has a .native variant +
          orientation support, so the structure reproduces in the app. */}
      <Tabs
        defaultValue="profile"
        orientation={isDesktop ? "vertical" : "horizontal"}
        variant={isDesktop ? "pill" : "underline"}
      >
        <XStack
          flexDirection={isDesktop ? "row" : "column"}
          gap={isDesktop ? "$6" : "$4"}
          items="flex-start"
        >
          {/* Transparent rail — no container card; the active item carries
              the only selection cue. */}
          <Tabs.List
            flexDirection={isDesktop ? "column" : "row"}
            width={isDesktop ? 200 : "100%"}
            shrink={0}
            gap="$1"
            bg="transparent"
            borderWidth={0}
            p={0}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Tabs.Tab
                  key={tab.id}
                  value={tab.id}
                  width={isDesktop ? "100%" : undefined}
                  justify={isDesktop ? "flex-start" : "center"}
                >
                  <XStack items="center" gap="$2">
                    <Icon size={16} />
                    <SizableText>{tab.label}</SizableText>
                  </XStack>
                </Tabs.Tab>
              );
            })}
          </Tabs.List>

          <YStack flex={1} minW={0}>
            <Tabs.Content value="profile" {...FLAT_CONTENT}>
              <ProfileForm />
            </Tabs.Content>
            <Tabs.Content value="targets" {...FLAT_CONTENT}>
              <TargetsSettings />
            </Tabs.Content>
            <Tabs.Content value="account" {...FLAT_CONTENT}>
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
          </YStack>
        </XStack>
      </Tabs>
    </YStack>
  );
}
