"use client";

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
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FeedbackType = "bug" | "feature" | "general";

const feedbackTypes: {
  value: FeedbackType;
  label: string;
  icon: typeof Bug;
  description: string;
  color: string;
  activeBg: string;
  activeBorder: string;
}[] = [
  {
    value: "general",
    label: "General",
    icon: MessageCircle,
    description: "Share your thoughts",
    color: "text-blue-500",
    activeBg: "bg-blue-500/10",
    activeBorder: "border-blue-500/40",
  },
  {
    value: "bug",
    label: "Bug",
    icon: Bug,
    description: "Something's broken",
    color: "text-red-500",
    activeBg: "bg-red-500/10",
    activeBorder: "border-red-500/40",
  },
  {
    value: "feature",
    label: "Feature",
    icon: Lightbulb,
    description: "Suggest a feature",
    color: "text-amber-500",
    activeBg: "bg-amber-500/10",
    activeBorder: "border-amber-500/40",
  },
];

export function FeedbackButton({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/feedback", { type, message: message.trim() });
      toast.success("Thanks for your feedback!");
      setMessage("");
      setType("general");
      setOpen(false);
      onNavigate?.();
    } catch {
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground">
          <MessageSquarePlus className="size-4" />
          Feedback
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80 p-0">
        <div className="p-4">
          <p className="text-sm font-semibold">How can we improve?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We&apos;d love to hear from you
          </p>

          {/* Type selector — card style */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {feedbackTypes.map((ft) => {
              const Icon = ft.icon;
              const isActive = type === ft.value;
              return (
                <button
                  key={ft.value}
                  onClick={() => setType(ft.value)}
                  className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all ${
                    isActive
                      ? `${ft.activeBg} ${ft.activeBorder}`
                      : "border-border/60 hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <Icon
                    className={`size-4 transition-colors ${
                      isActive
                        ? ft.color
                        : "text-muted-foreground group-hover:text-foreground/70"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium leading-tight ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {ft.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === "bug"
                ? "What happened? What did you expect?"
                : type === "feature"
                  ? "What would you like to see?"
                  : "Tell us what you think..."
            }
            rows={3}
            className="mt-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <Button
            size="sm"
            className="mt-2.5 w-full gap-2"
            disabled={!message.trim() || submitting}
            onClick={handleSubmit}
          >
            <Send className="size-3.5" />
            {submitting ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
