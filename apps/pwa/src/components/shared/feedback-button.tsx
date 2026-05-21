import { useState } from "react";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
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
} from "@stageholder/ui";

type FeedbackType = "bug" | "feature" | "general";

// Per-type icon color is the semantic cue — Bug = red (error language),
// Feature = amber (suggestion / warmth), General = blue (neutral talk).
// Kept on the icon even when the card is inactive, since the color *is*
// the type identifier.
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
    iconColor: "text-blue-500",
  },
  {
    value: "bug",
    label: "Bug",
    icon: Bug,
    iconColor: "text-red-500",
  },
  {
    value: "feature",
    label: "Feature",
    icon: Lightbulb,
    iconColor: "text-amber-500",
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

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/feedback", { type, message: message.trim() });
      toast.success("Thanks for your feedback!");
      setMessage("");
      setType("general");
      setOpen(false);
      // Close the mobile drawer after a successful submission so the user
      // lands back on whatever screen they were on. No-op on desktop.
      if (isMobile) setOpenMobile(false);
    } catch {
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="right-end">
      <Popover.Trigger asChild>
        <Sidebar.MenuButton
          icon={
            <MessageSquarePlus className="size-4 text-sidebar-foreground" />
          }
        >
          Feedback
        </Sidebar.MenuButton>
      </Popover.Trigger>
      <Popover.Content className="w-80 p-0">
        <div className="p-4">
          <p className="text-sm font-semibold">How can we improve?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We&apos;d love to hear from you
          </p>

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
                    <Icon className={`size-4 ${ft.iconColor}`} />
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
            className="mt-3"
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
            icon={<Send className="size-3.5" />}
            className="mt-2.5 w-full gap-2"
            disabled={!message.trim() || submitting}
            loading={submitting}
            loadingText="Sending…"
            onPress={handleSubmit}
          >
            Send Feedback
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  );
}
