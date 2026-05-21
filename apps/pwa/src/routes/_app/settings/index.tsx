import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, ArrowRight } from "lucide-react";
import { Button, SizableText, Tabs } from "@stageholder/ui";
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
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

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

        <div className="max-w-2xl">
          <Tabs.Content value="profile">
            <ProfileForm />
          </Tabs.Content>
          <Tabs.Content value="targets">
            <TargetsSettings />
          </Tabs.Content>
          <Tabs.Content value="account">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your billing and subscription live in-app. Password, MFA,
                connected accounts, sessions, and account deletion are managed
                on Stageholder.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  intent="outline"
                  iconAfter={<ArrowRight className="size-3.5 opacity-70" />}
                  onPress={() => void navigate({ to: "/settings/billing" })}
                >
                  Billing &amp; subscription
                </Button>
                <Button
                  iconAfter={<ArrowRight className="size-3.5 opacity-70" />}
                  onPress={() =>
                    void navigate({ to: "/settings/billing/upgrade" })
                  }
                >
                  Upgrade plan
                </Button>
                <Button
                  tag="a"
                  href={`${HUB_URL}/account`}
                  target="_blank"
                  rel="noopener"
                  intent="outline"
                  iconAfter={<ExternalLink className="size-3.5 opacity-70" />}
                >
                  Security &amp; sign-in on Stageholder
                </Button>
              </div>
            </div>
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  );
}
