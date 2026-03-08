"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api-client";
import type { Workspace } from "@repo/core/types";

type ActionType = "habit" | "journal";

function getActionType(goals: string[]): ActionType {
  if (goals.includes("journaling") && !goals.includes("health") && !goals.includes("habits")) {
    return "journal";
  }
  return "habit";
}

export function FirstActionStep({
  selectedGoals,
  personalWorkspaceShortId,
  onContinue,
  onSkip,
}: {
  selectedGoals: string[];
  personalWorkspaceShortId?: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const actionType = getActionType(selectedGoals);
  const [habitName, setHabitName] = useState("");
  const [habitTarget, setHabitTarget] = useState("1");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!personalWorkspaceShortId) return;
    apiClient
      .get<Workspace>(`/workspaces/${personalWorkspaceShortId}`)
      .then((res) => setWorkspaceId(res.data.id))
      .catch(() => {});
  }, [personalWorkspaceShortId]);

  async function handleCreate() {
    if (!workspaceId) return;
    setSaving(true);
    try {
      if (actionType === "habit") {
        await apiClient.post(`/workspaces/${workspaceId}/habits`, {
          name: habitName.trim() || "Check in with Meridian",
          targetCount: parseInt(habitTarget, 10) || 1,
        });
      } else {
        const today = new Date().toISOString().split("T")[0];
        await apiClient.post(`/workspaces/${workspaceId}/journals`, {
          title: journalTitle.trim() || "Day one with Meridian",
          content: journalContent.trim() || "Starting my journey with Meridian today. Excited to build better habits and stay organized.",
          date: today,
        });
      }
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
        <h2 className="text-xl font-bold text-foreground">
          {actionType === "habit" ? "Create your first habit" : "Write your first journal entry"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {actionType === "habit"
            ? "Start with a simple habit you want to build."
            : "Capture your first thoughts."}
        </p>
      </div>

      {actionType === "habit" ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="habit-name" className="block text-sm font-medium text-foreground">
              Habit name
            </label>
            <input
              id="habit-name"
              type="text"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="e.g. Drink water"
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="habit-target" className="block text-sm font-medium text-foreground">
              Daily target
            </label>
            <input
              id="habit-target"
              type="number"
              min="1"
              value={habitTarget}
              onChange={(e) => setHabitTarget(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="journal-title" className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="journal-title"
              type="text"
              value={journalTitle}
              onChange={(e) => setJournalTitle(e.target.value)}
              placeholder="My first entry"
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="journal-content" className="block text-sm font-medium text-foreground">
              Content
            </label>
            <textarea
              id="journal-content"
              rows={3}
              value={journalContent}
              onChange={(e) => setJournalContent(e.target.value)}
              placeholder="What's on your mind?"
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleCreate}
          disabled={saving || !workspaceId}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Creating..." : "Create & Continue"}
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip this
        </button>
      </div>
    </div>
  );
}
