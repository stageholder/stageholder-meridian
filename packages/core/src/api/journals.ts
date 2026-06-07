import type { ApiClientLike } from "./client";
import type { Journal, JournalContent, JournalStats } from "@repo/core/types";

/**
 * Create body — plaintext, or the E2E-encrypted variant produced by the
 * PWA's `encryptJournalPayload`. In the encrypted shape `title`/`content`/
 * `tags` are opaque ciphertext strings, `encrypted: true` flags the format
 * for the server, and `wordCount` is precomputed client-side (the server
 * can't count words it can't read).
 */
export type CreateJournalBody =
  | {
      title: string;
      content: JournalContent;
      mood?: number;
      tags?: string[];
      date?: string;
    }
  | {
      title: string;
      content: string;
      tags: string;
      mood?: number;
      date?: string;
      encrypted: true;
      wordCount: number;
    };

/** Update body — same plaintext/encrypted split as {@link CreateJournalBody}. */
export type UpdateJournalBody =
  | {
      title?: string;
      content?: JournalContent;
      mood?: number;
      tags?: string[];
    }
  | {
      title: string;
      content: string;
      tags: string;
      mood?: number;
      date?: string;
      encrypted: true;
      wordCount: number;
    };

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
    create: async (data: CreateJournalBody): Promise<Journal> => {
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
    update: async (id: string, data: UpdateJournalBody): Promise<Journal> => {
      const res = await client.patch(`/journals/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/journals/${id}`);
    },
  };
}

export type JournalsApi = ReturnType<typeof createJournalsApi>;
