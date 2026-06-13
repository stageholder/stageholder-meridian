import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ExternalLink,
  ArrowRight,
  KeyRound,
  User,
  Target,
  CreditCard,
} from "lucide-react";
import {
  Button,
  Dialog,
  H1,
  Paragraph,
  SizableText,
  Tabs,
  XStack,
  YStack,
  useMedia,
  useToast,
} from "@stageholder/ui";
import { PassphraseChangeForm } from "@repo/features/encryption";
import { ProfileForm } from "@/components/settings/profile-form";
import { TargetsSettings } from "@/components/settings/targets-settings";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";

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

/**
 * Change-journal-passphrase entry — shown only once encryption is set up.
 * Hosts the shared PassphraseChangeForm (also used by mobile's settings
 * sheet) in a Dialog wired to the encryption store. checkStatus on mount:
 * /settings is reachable without visiting the journal, so the wrapped key
 * material may not be loaded yet — the change flow needs it.
 */
function ChangePassphraseBlock() {
  const { isSetup, checkStatus, changePassphrase } = useEncryptionStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  if (!isSetup) return null;

  return (
    <>
      <Button
        intent="outline"
        iconAfter={<KeyRound size={14} opacity={0.7} />}
        onPress={() => setOpen(true)}
      >
        Change journal passphrase
      </Button>
      {/* Conditionally mounted — closing must UNMOUNT so the scrim clears
          under disableExtraction (the habit-delete dialog pattern). */}
      {open && (
        <Dialog open disableRemoveScroll>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content
              maxW={448}
              onInteractOutside={(e: Event) => e.preventDefault()}
            >
              <YStack gap="$2">
                <Dialog.Title>Change Journal Passphrase</Dialog.Title>
                <Dialog.Description>
                  Your entries stay encrypted — only the passphrase that unlocks
                  them changes. Recovery codes keep working.
                </Dialog.Description>
              </YStack>
              <PassphraseChangeForm
                onChangePassphrase={changePassphrase}
                onComplete={() => {
                  setOpen(false);
                  toast.show({
                    title: "Passphrase changed",
                    intent: "success",
                  });
                }}
                onCancel={() => setOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      )}
    </>
  );
}

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
                  <ChangePassphraseBlock />
                </YStack>
              </YStack>
            </Tabs.Content>
          </YStack>
        </XStack>
      </Tabs>
    </YStack>
  );
}
