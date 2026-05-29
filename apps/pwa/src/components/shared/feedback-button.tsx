import { useState } from "react";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  MessageCircle,
  Send,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import {
  Button,
  Popover,
  Sidebar,
  Text,
  TextArea,
  XStack,
  YStack,
  useSidebar,
  useToast,
} from "@stageholder/ui";

type FeedbackType = "bug" | "feature" | "general";

// Per-type icon color is the semantic cue — Bug = destructive (error
// language), Feature = warning amber (suggestion / warmth), General = info
// (neutral talk). Kept on the icon even when the card is inactive, since the
// color *is* the type identifier. The icon inherits the token via
// `currentColor` from its wrapping <Text color={…}>.
const feedbackTypes: {
  value: FeedbackType;
  label: string;
  icon: typeof Bug;
  iconColor: string;
}[] = [
  {
    value: "general",
    label: "General",
    icon: MessageCircle,
    iconColor: "$info",
  },
  {
    value: "bug",
    label: "Bug",
    icon: Bug,
    iconColor: "$destructive",
  },
  {
    value: "feature",
    label: "Feature",
    icon: Lightbulb,
    iconColor: "$warning",
  },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Sidebar context is always available here because FeedbackButton lives
  // exclusively inside <Sidebar.Footer> within the app shell. If we ever
  // need this component outside a Sidebar, swap to a guarded version.
  const { setOpenMobile, isMobile } = useSidebar();
  const toast = useToast();

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/feedback", { type, message: message.trim() });
      toast.show({ title: "Thanks for your feedback!", intent: "success" });
      setMessage("");
      setType("general");
      setOpen(false);
      // Close the mobile drawer after a successful submission so the user
      // lands back on whatever screen they were on. No-op on desktop.
      if (isMobile) setOpenMobile(false);
    } catch {
      toast.show({
        title: "Failed to send feedback. Please try again.",
        intent: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="right-end">
      <Popover.Trigger asChild>
        <Sidebar.MenuButton icon={<MessageSquarePlus size={16} />}>
          Feedback
        </Sidebar.MenuButton>
      </Popover.Trigger>
      {/* `Popover.Content size="$3"` uses the kit/Tamagui-idiomatic
          sizing token — that drives default padding & borderRadius
          consistently with the rest of the design system, instead of
          us hand-picking `p` values. Width stays explicit because
          SizableStack doesn't infer width from the size token. */}
      <Popover.Content size="$3" width={340}>
        <YStack gap="$3" width="100%">
          <Text fontSize="$3" fontWeight="600" color="$color">
            Send us feedback
          </Text>

          {/* Type picker — three kit `Button` chips in an XStack with
              `flex={1}`. We dropped `ToggleGroup` here: Tamagui's
              `Toggle` primitive (which ToggleGroup.Item extends) bakes
              a fixed `width`/`height` into its `size: '$true'` default
              variant (see @tamagui/toggle-group Toggle.tsx), so
              `flex={1}` can't distribute width across items. Plain
              `Button` doesn't set a width, so `flex={1}` works.
              Active state is signalled by a brand-tinted background +
              brand border on top of the `outline` intent; the icon
              keeps its semantic colour in both states so the type
              identity reads even when inactive. */}
          <XStack gap="$2">
            {feedbackTypes.map((ft) => {
              const isActive = type === ft.value;
              const Icon = ft.icon;
              return (
                <Button
                  key={ft.value}
                  flex={1}
                  size="sm"
                  intent="outline"
                  bg={isActive ? "$primaryMuted" : "$background"}
                  borderColor={isActive ? "$primary" : "$borderColor"}
                  onPress={() => setType(ft.value)}
                >
                  <XStack items="center" gap="$1.5">
                    {/* Icon inherits semantic colour via currentColor
                        from the wrapping Text token. `as never` is the
                        codebase's established escape hatch for theme
                        tokens whose TS type is narrower than the
                        runtime accepts. */}
                    <Text color={ft.iconColor as never} lineHeight={0}>
                      <Icon size={13} />
                    </Text>
                    <Text fontSize="$2" fontWeight="500" color="$color">
                      {ft.label}
                    </Text>
                  </XStack>
                </Button>
              );
            })}
          </XStack>

          <TextArea
            value={message}
            onChangeText={setMessage}
            placeholder={
              type === "bug"
                ? "What happened? What did you expect?"
                : type === "feature"
                  ? "What would you like to see?"
                  : "Tell us what you think…"
            }
            minH={88}
          />

          {/* Right-aligned submit — feels like sending a message rather
              than committing to a form. Matches the conversational
              tone of a sidebar feedback widget. */}
          <XStack justify="flex-end">
            <Button
              size="sm"
              intent="primary"
              icon={<Send size={13} />}
              disabled={!message.trim() || submitting}
              loading={submitting}
              loadingText="Sending…"
              onPress={handleSubmit}
            >
              Send
            </Button>
          </XStack>
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
