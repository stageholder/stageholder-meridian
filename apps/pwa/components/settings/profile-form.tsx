"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { toast } from "sonner";
import type { AuthUser } from "@repo/core/types";
import { TimezoneSelect } from "@/components/ui/timezone-select";

export function ProfileForm() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data;
    },
  });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: async (data: { name?: string; timezone?: string }) => {
      const res = await apiClient.patch("/auth/me", data);
      return res.data as AuthUser;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateProfile.mutate({ name: name.trim(), timezone });
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="profile-name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="profile-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={user?.email || ""}
          disabled
          className="mt-1 block w-full max-w-md rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      <div>
        <label htmlFor="profile-timezone" className="block text-sm font-medium text-foreground">
          Timezone
        </label>
        <TimezoneSelect
          value={timezone}
          onValueChange={setTimezone}
          className="mt-1 max-w-md"
        />
      </div>

      <button
        type="submit"
        disabled={updateProfile.isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {updateProfile.isPending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
