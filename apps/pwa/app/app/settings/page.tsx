"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";
import { TargetsSettings } from "@/components/settings/targets-settings";
import { useUser } from "@/hooks/use-user";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://id.stageholder.com";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "targets", label: "Targets" },
  { id: "account", label: "Account" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const { data: user } = useUser();
  const personalOrgSlug = user?.personalOrgSlug;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="scrollbar-hide flex gap-4 overflow-x-auto sm:gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl">
        {activeTab === "profile" && <ProfileForm />}
        {activeTab === "targets" && <TargetsSettings />}
        {activeTab === "account" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account, billing, and subscription are managed on
              Stageholder.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`${HUB_URL}/account/profile`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Manage account on Stageholder
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
              <a
                href={`${HUB_URL}/pricing/meridian`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Upgrade to Unlimited
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
              {personalOrgSlug && (
                <a
                  href={`${HUB_URL}/account/${personalOrgSlug}/billing`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Manage subscription
                  <ExternalLink className="size-3.5 opacity-70" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
