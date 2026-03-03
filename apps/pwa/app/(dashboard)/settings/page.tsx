"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";
import { MembersList } from "@/components/settings/members-list";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Members" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and workspace settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
        {activeTab === "workspace" && <WorkspaceSettings />}
        {activeTab === "members" && <MembersList />}
      </div>
    </div>
  );
}
