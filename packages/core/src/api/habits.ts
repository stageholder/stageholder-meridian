import type { AxiosInstance } from "axios";
import type { Habit, HabitEntry } from "@repo/core/types";

/**
 * Habits API client. Routes are rooted at `/habits` — scoping is per
 * authenticated user server-side, so no workspace prefix is needed.
 */
export function createHabitsApi(client: AxiosInstance) {
  return {
    // Habits
    create: async (data: {
      name: string;
      description?: string;
      frequency?: string;
      targetCount?: number;
      unit?: string;
      color?: string;
      icon?: string;
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
        unit?: string;
        color?: string;
        icon?: string;
      },
    ): Promise<Habit> => {
      const res = await client.patch(`/habits/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/habits/${id}`);
    },

    // Habit Entries
    createEntry: async (
      habitId: string,
      data: {
        date: string;
        value: number;
        notes?: string;
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
