"use client";

import { ExternalLink } from "lucide-react";
import { useUser } from "@/hooks/use-user";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://id.stageholder.com";

export function ProfileForm() {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading profile...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          type="text"
          value={user?.name ?? ""}
          disabled
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          type="email"
          value={user?.email ?? ""}
          disabled
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Profile information is managed on Stageholder.
      </p>

      <a
        href={`${HUB_URL}/account/profile`}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Edit profile on Stageholder
        <ExternalLink className="size-3.5 opacity-80" />
      </a>
    </div>
  );
}
