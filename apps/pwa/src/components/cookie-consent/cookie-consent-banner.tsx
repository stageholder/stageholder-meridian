import { useEffect, useState } from "react";
import { BarChart3, Cookie, Lock, Settings, Shield, Target } from "@tamagui/lucide-icons-2";
import {
  Button,
  Dialog,
  Icon,
  Paragraph,
  Switch,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";

import {
  ALL_GRANTED,
  ESSENTIAL_ONLY,
  OPEN_COOKIE_SETTINGS_EVENT,
  readConsent,
  saveConsent,
  type ConsentState,
} from "@/analytics/consent";

type CategoryId = "analytics_storage" | "ad_storage" | "personalization_storage";

const CATEGORIES: {
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof BarChart3;
}[] = [
  {
    id: "analytics_storage",
    label: "Analytics",
    description:
      "Help us understand how Meridian is used so we can improve it. Includes page views and feature usage.",
    icon: BarChart3,
  },
  {
    id: "ad_storage",
    label: "Advertising",
    description: "Measure how our advertising campaigns on Google perform.",
    icon: Target,
  },
  {
    id: "personalization_storage",
    label: "Personalization",
    description: "Remember content and recommendations tailored to how you use Stageholder.",
    icon: Shield,
  },
];

function ConsentRow({
  icon,
  label,
  description,
  control,
}: {
  icon: typeof Lock;
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <XStack
      justify="space-between"
      items="flex-start"
      gap="$3"
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$3"
      p="$3"
    >
      <XStack items="flex-start" gap="$2.5" shrink={1}>
        <Icon source={icon} size={14} color="$mutedForeground" mt={2} />
        <YStack gap={2} shrink={1}>
          <Text fontSize={12} fontWeight="500">
            {label}
          </Text>
          <Paragraph fontSize={11} lineHeight={18} color="$mutedForeground">
            {description}
          </Paragraph>
        </YStack>
      </XStack>
      {control}
    </XStack>
  );
}

function ConsentPreferences({
  open,
  consent,
  onClose,
  onCommit,
}: {
  open: boolean;
  consent: ConsentState;
  onClose: () => void;
  onCommit: (state: ConsentState) => void;
}) {
  const [draft, setDraft] = useState<ConsentState>(consent);

  // Start from the saved choice (or essential-only) every time it opens.
  useEffect(() => {
    if (open) setDraft(consent);
  }, [open, consent]);

  const toggle = (id: CategoryId, checked: boolean) => {
    const value = checked ? "granted" : "denied";
    // Advertising covers all three ad signals in Consent Mode v2.
    setDraft((prev) =>
      id === "ad_storage"
        ? { ...prev, ad_storage: value, ad_user_data: value, ad_personalization: value }
        : { ...prev, [id]: value },
    );
  };

  return (
    <Dialog modal open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content maxW={512}>
          <YStack gap="$1">
            <Dialog.Title fontSize={14} fontWeight="500">
              Cookie preferences
            </Dialog.Title>
            <Dialog.Description fontSize={12}>
              Your choice applies to stageholder.com and every Stageholder app. You can change it
              anytime from your user menu.
            </Dialog.Description>
          </YStack>

          <YStack gap="$3" py="$3">
            <ConsentRow
              icon={Lock}
              label="Essential"
              description="Required for sign-in, security and remembering your settings. Always on."
              control={
                <Switch size="$2" checked disabled aria-label="Essential cookies">
                  <Switch.Thumb />
                </Switch>
              }
            />
            {CATEGORIES.map((category) => (
              <ConsentRow
                key={category.id}
                icon={category.icon}
                label={category.label}
                description={category.description}
                control={
                  <Switch
                    size="$2"
                    checked={draft[category.id] === "granted"}
                    onCheckedChange={(checked: boolean) => toggle(category.id, checked)}
                    aria-label={category.label}
                  >
                    <Switch.Thumb />
                  </Switch>
                }
              />
            ))}
          </YStack>

          <XStack justify="flex-end" gap="$2" flexWrap="wrap">
            <Button intent="outline" size="sm" onPress={() => onCommit(ESSENTIAL_ONLY)}>
              Reject all
            </Button>
            <Button intent="outline" size="sm" onPress={() => onCommit(ALL_GRANTED)}>
              Accept all
            </Button>
            <Button size="sm" onPress={() => onCommit(draft)}>
              Save preferences
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

/**
 * Consent Mode v2 banner backed by the STAGEHOLDER_CONSENT cookie shared across
 * *.stageholder.com — a visitor who already chose on stageholder.com or the
 * Hub never sees it here. Reject and Accept share one style on purpose (a
 * weaker "reject" is treated as a dark pattern). Reopen via openCookieSettings().
 */
export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);

    const openPreferences = () => {
      setConsent(readConsent());
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
  }, []);

  const commit = (state: ConsentState) => {
    saveConsent(state);
    setConsent(state);
    setPrefsOpen(false);
  };

  if (!ready) return null;

  const preferences = (
    <ConsentPreferences
      open={prefsOpen}
      consent={consent ?? ESSENTIAL_ONLY}
      onClose={() => setPrefsOpen(false)}
      onCommit={commit}
    />
  );

  if (consent) return preferences;

  return (
    <>
      <YStack
        position="fixed"
        b={0}
        l={0}
        r={0}
        z={50}
        bg="$background"
        borderTopWidth={1}
        borderColor="$borderColor"
        role="region"
        aria-labelledby="cookie-consent-title"
      >
        <YStack
          width="100%"
          maxW={1280}
          self="center"
          px="$4"
          py="$3"
          gap="$3"
          $md={{ flexDirection: "row", items: "center", justify: "space-between", px: "$6" }}
        >
          <XStack items="flex-start" gap="$3" shrink={1}>
            <Icon source={Cookie} size={16} color="$mutedForeground" />
            <YStack gap={2} shrink={1}>
              <Text id="cookie-consent-title" fontSize={12} fontWeight="500">
                We use cookies
              </Text>
              <Paragraph fontSize={12} color="$mutedForeground">
                Essential cookies keep you signed in. With your permission we also use Google
                Analytics and advertising cookies to understand usage across Stageholder.
              </Paragraph>
            </YStack>
          </XStack>

          <XStack items="center" gap="$2" flexWrap="wrap">
            <Button
              intent="ghost"
              size="sm"
              onPress={() => setPrefsOpen(true)}
              icon={<Icon source={Settings} size={12} />}
            >
              Customize
            </Button>
            <Button intent="outline" size="sm" onPress={() => commit(ESSENTIAL_ONLY)}>
              Reject all
            </Button>
            <Button intent="outline" size="sm" onPress={() => commit(ALL_GRANTED)}>
              Accept all
            </Button>
          </XStack>
        </YStack>
      </YStack>

      {preferences}
    </>
  );
}
