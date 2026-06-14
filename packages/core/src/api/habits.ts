import type { ApiClientLike } from "./client";
import type { Habit, HabitEntry, HabitGroup } from "@repo/core/types";

/**
 * Habits API client. Routes are rooted at `/habits` — scoping is per
 * authenticated user server-side, so no workspace prefix is needed.
 */
export function createHabitsApi(client: ApiClientLike) {
  return {
    // Habits
    create: async (data: {
      name: string;
      description?: string;
      frequency?: string;
      targetCount?: number;
      scheduledDays?: number[];
      weeklyTarget?: number;
      unit?: string;
      color?: string;
      icon?: string;
      groupId?: string | null;
    }): Promise<Habit> => {
      const res = await client.post(`/habits`, data);
      return res.data;
    },
    list: async (params?: Record<string, string>): Promise<Habit[]> => {
      const res = await client.get(`/habits`, { params });
      return res.data?.data ?? res.data;
    },
    get: async (id: string): Promise<Habit> => {
      const res = await client.get(`/habits/${id}`);
      return res.data;
    },
    update: async (
      id: string,
      data: {
        name?: string;
        description?: string;
        frequency?: string;
        targetCount?: number;
        scheduledDays?: number[] | null;
        weeklyTarget?: number;
        unit?: string;
        color?: string;
        icon?: string;
        groupId?: string | null;
      },
    ): Promise<Habit> => {
      const res = await client.patch(`/habits/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/habits/${id}`);
    },

    // Reorder habits (within a group) and/or move between groups. Mirrors
    // `reorderTodos`: an array of {id, order, groupId?} so the server applies a
    // sparse update; including groupId moves the habit in the same call.
    reorder: async (data: {
      items: { id: string; order: number; groupId?: string | null }[];
    }): Promise<void> => {
      await client.post(`/habits/reorder`, data);
    },
    archive: async (id: string): Promise<Habit> => {
      const res = await client.post(`/habits/${id}/archive`, {});
      return res.data;
    },
    unarchive: async (id: string): Promise<Habit> => {
      const res = await client.post(`/habits/${id}/unarchive`, {});
      return res.data;
    },

    // Habit Groups
    createGroup: async (data: {
      name: string;
      color?: string;
      icon?: string;
    }): Promise<HabitGroup> => {
      const res = await client.post(`/habit-groups`, data);
      return res.data;
    },
    listGroups: async (
      params?: Record<string, string>,
    ): Promise<HabitGroup[]> => {
      const res = await client.get(`/habit-groups`, { params });
      return res.data?.data ?? res.data;
    },
    getGroup: async (groupId: string): Promise<HabitGroup> => {
      const res = await client.get(`/habit-groups/${groupId}`);
      return res.data;
    },
    updateGroup: async (
      groupId: string,
      data: { name?: string; color?: string; icon?: string },
    ): Promise<HabitGroup> => {
      const res = await client.patch(`/habit-groups/${groupId}`, data);
      return res.data;
    },
    deleteGroup: async (groupId: string): Promise<void> => {
      await client.delete(`/habit-groups/${groupId}`);
    },
    reorderGroups: async (data: {
      items: { id: string; order: number }[];
    }): Promise<void> => {
      await client.post(`/habit-groups/reorder`, data);
    },

    // Habit Entries
    createEntry: async (
      habitId: string,
      data: {
        date: string;
        value: number;
        notes?: string;
        // `type` discriminates the entry: a normal completion, a skip
        // (preserves the streak), or a fail (breaks the streak). The
        // server enforces `value === 0` for skip/fail and clears
        // `skipReason` for completions.
        type?: "completion" | "skip" | "fail";
        skipReason?: string;
      },
    ): Promise<HabitEntry> => {
      const res = await client.post(`/habits/${habitId}/entries`, data);
      return res.data;
    },
    listEntries: async (
      habitId: string,
      params?: { startDate?: string; endDate?: string },
    ): Promise<HabitEntry[]> => {
      const res = await client.get(`/habits/${habitId}/entries`, {
        params,
      });
      return res.data?.data ?? res.data;
    },
    updateEntry: async (
      habitId: string,
      entryId: string,
      data: {
        value?: number;
        notes?: string;
        // Lets callers convert an existing entry between completion / skip /
        // fail without hitting the per-(habit, date) uniqueness conflict that
        // a DELETE + POST would cause. The server enforces the value=0
        // invariant for skip/fail and clears skipReason on completion.
        type?: "completion" | "skip" | "fail";
        skipReason?: string;
      },
    ): Promise<HabitEntry> => {
      const res = await client.patch(
        `/habits/${habitId}/entries/${entryId}`,
        data,
      );
      return res.data;
    },
    deleteEntry: async (habitId: string, entryId: string): Promise<void> => {
      await client.delete(`/habits/${habitId}/entries/${entryId}`);
    },

    listAllEntries: async (
      params?: Record<string, unknown>,
    ): Promise<HabitEntry[]> => {
      const res = await client.get(`/habit-entries`, { params });
      return res.data?.data ?? res.data;
    },
  };
}

export type HabitsApi = ReturnType<typeof createHabitsApi>;
