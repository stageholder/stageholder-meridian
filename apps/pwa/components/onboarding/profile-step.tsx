"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@repo/core/types";

export function ProfileStep({ onContinue }: { onContinue: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user?.name || "");
  const [timezone, setTimezone] = useState(
    user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [user]);

  async function handleContinue() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.patch<AuthUser>("/auth/me", {
        name: name.trim(),
        timezone,
      });
      // Merge with existing store data to preserve personalWorkspaceShortId
      setUser({ ...res.data, personalWorkspaceShortId: user?.personalWorkspaceShortId });
    } catch {
      // continue anyway
    } finally {
      setSaving(false);
      onContinue();
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Set up your profile</h2>
        <p className="text-sm text-muted-foreground">
          Confirm your name and timezone so everything stays in sync.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="onboard-name" className="block text-sm font-medium text-foreground">
            Display name
          </label>
          <input
            id="onboard-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div>
          <label htmlFor="onboard-tz" className="block text-sm font-medium text-foreground">
            Timezone
          </label>
          <select
            id="onboard-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            {Intl.supportedValuesOf("timeZone").map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
