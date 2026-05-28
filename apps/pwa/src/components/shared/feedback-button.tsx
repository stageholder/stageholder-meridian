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
  ToggleGroup,
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
      <Popover.Content width={320} p={0}>
        <YStack p="$4">
          <Text fontSize="$3" fontWeight="600" color="$color">
            How can we improve?
          </Text>
          <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
            We&apos;d love to hear from you
          </Text>

          {/* Type selector — kit ToggleGroup cards, single-select.
              Three cards in a row, so `columns={3}` overrides the default
              2-col grid. Card chrome (border/bg/hover/active) comes from
              the kit; we keep the per-type icon color so users still
              identify types by color even when inactive. */}
          <ToggleGroup
            variant="cards"
            type="single"
            columns={3}
            value={type}
            onValueChange={(v) => v && setType(v as FeedbackType)}
            mt="$3"
          >
            {feedbackTypes.map((ft) => {
              const Icon = ft.icon;
              return (
                <ToggleGroup.Item key={ft.value} value={ft.value}>
                  <YStack items="center" gap="$1.5">
                    {/* icon inherits the semantic token via currentColor */}
                    <Text color={ft.iconColor}>
                      <Icon size={16} />
                    </Text>
                    <Text fontSize={11} fontWeight="500" color="$color">
                      {ft.label}
                    </Text>
                  </YStack>
                </ToggleGroup.Item>
              );
            })}
          </ToggleGroup>

          {/* Message */}
          <TextArea
            mt="$3"
            value={message}
            onChangeText={setMessage}
            placeholder={
              type === "bug"
                ? "What happened? What did you expect?"
                : type === "feature"
                  ? "What would you like to see?"
                  : "Tell us what you think..."
            }
            rows={3}
          />

          <Button
            size="sm"
            icon={<Send size={14} />}
            mt="$2.5"
            width="100%"
            gap="$2"
            disabled={!message.trim() || submitting}
            loading={submitting}
            loadingText="Sending…"
            onPress={handleSubmit}
          >
            Send Feedback
          </Button>
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
