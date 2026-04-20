"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://id.stageholder.com";

export interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: "max_habits" | "max_todo_lists" | "max_active_todos" | string;
  limit: number;
}

const FEATURE_LABELS: Record<string, string> = {
  max_habits: "habits",
  max_todo_lists: "todo lists",
  max_active_todos: "active todos",
};

export function PaywallModal({
  open,
  onClose,
  feature,
  limit,
}: PaywallModalProps) {
  const label = FEATURE_LABELS[feature] ?? "items";
  const upgradeHref = `${HUB_URL}/pricing/meridian`;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You&apos;ve reached your limit</DialogTitle>
          <DialogDescription>
            Free users can create up to {limit} {label}. Upgrade to Unlimited
            for unlimited {label} and every future feature.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Maybe later
          </Button>
          <Button asChild>
            <a href={upgradeHref} target="_blank" rel="noopener">
              Upgrade to Unlimited
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
