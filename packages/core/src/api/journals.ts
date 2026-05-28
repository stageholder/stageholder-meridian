import type { ApiClientLike } from "./client";
import type { Journal, JournalStats } from "@repo/core/types";

/**
 * Full pagination envelope returned by `GET /journals` when called with
 * `{ page, limit }` query params. The default `list()` method strips this
 * down to just the data array — use `listPaginated()` when you need the
 * `meta` for infinite-scroll / paged tables.
 */
export interface PaginatedJournals {
  data: Journal[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * Journals API client. Routes are rooted at `/journals` — the Hub-integrated
 * API scopes everything off the authenticated `sub` server-side, so there is
 * no longer a workspace prefix.
 */
export function createJournalsApi(client: ApiClientLike) {
  return {
    create: async (data: {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }): Promise<Journal> => {
      const res = await client.post(`/journals`, data);
      return res.data;
    },
    list: async (
      params?: Record<string, string | undefined>,
    ): Promise<Journal[]> => {
      const res = await client.get(`/journals`, { params });
      return res.data?.data ?? res.data;
    },
    /**
     * Paged variant of `list()` — returns the full `{ data, meta }` envelope
     * so callers can drive infinite-scroll / pagination from `meta.totalPages`
     * and `meta.page`. Hits the same `GET /journals` endpoint as `list()`.
     */
    listPaginated: async (params?: {
      page?: number;
      limit?: number;
    }): Promise<PaginatedJournals> => {
      const res = await client.get(`/journals`, { params });
      return res.data as PaginatedJournals;
    },
    /**
     * Daily journaling stats (per-day count + words) plus an all-time baseline,
     * used to drive the dashboard's Journal Growth chart and the journal
     * ring's denominator. Pass `today` so the server can compute the local
     * boundary correctly (the API is timezone-agnostic).
     */
    stats: async (params: { today: string }): Promise<JournalStats> => {
      const res = await client.get(`/journals/stats`, { params });
      return res.data;
    },
    get: async (id: string): Promise<Journal> => {
      const res = await client.get(`/journals/${id}`);
      return res.data;
    },
    update: async (
      id: string,
      data: {
        title?: string;
        content?: string;
        mood?: number;
        tags?: string[];
      },
    ): Promise<Journal> => {
      const res = await client.patch(`/journals/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/journals/${id}`);
    },
  };
}

export type JournalsApi = ReturnType<typeof createJournalsApi>;
