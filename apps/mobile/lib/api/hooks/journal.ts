// apps/mobile/lib/api/hooks/journal.ts
//
// React Query hooks for /journals. Aligned with @repo/core/types — fields
// are `title`, `content`, `date` (yyyy-mm-dd), `wordCount` (server-computed),
// `tags` (string[] or comma-string per server normalization).
//
// EntryEditor autosave hammers useUpdateJournal — onSettled invalidates
// lazily so we don't thrash the network on every keystroke.

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Journal, JournalContent, JournalStats } from "@repo/core/types";

import { apiClient } from "../client";
import { journalKeys } from "../keys";
import {
  invalidateDashboardToday,
  invalidateDebounced,
  settleDerivedAggregates,
  writeDashboardJournal,
} from "../dashboard-cache";

// The calendar month aggregate shows journals (agenda rows, journal ring,
// weekly activity) — same month-scoped edge the PWA invalidates.
function invalidateJournalMonth(qc: QueryClient, date?: string) {
  if (date)
    void qc.invalidateQueries({ queryKey: ["calendar", date.slice(0, 7)] });
}
import {
  decryptJournalEntry,
  decryptJournalList,
  encryptJournalPayload,
  getJournalDek,
  isJournalEncryptionSetup,
  journalDekEpoch,
  type EncryptedJournalPayload,
} from "@/lib/journal-crypto";

// Thrown (and surfaced by the autosave hook's error status) instead of ever
// sending cleartext when encryption is configured but the journal is locked —
// the "never write plaintext when encryption is set up" invariant.
const LOCKED_WRITE_MESSAGE =
  "Journal is locked — unlock it before saving so entries aren't stored unencrypted.";

/* ------------------------------ Reads -------------------------------- */

export function useJournals(
  filters?: {
    startDate?: string;
    endDate?: string;
  },
  options?: { enabled?: boolean },
) {
  const epoch = journalDekEpoch();
  return useQuery({
    queryKey: [...journalKeys.list(filters), epoch] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Journal[] } | Journal[]>(
        "/journals",
        { params: filters },
      );
      const raw = Array.isArray(data) ? data : data.data;
      const dek = getJournalDek();
      return dek ? await decryptJournalList(raw, dek) : raw;
    },
    enabled: options?.enabled !== false,
  });
}

/**
 * Full pagination envelope from `GET /journals?page=&limit=` — same endpoint
 * as `useJournals`, but keeping the `{ data, meta }` wrapper so the journal
 * tab can drive an infinite "Load more" list (PWA `useJournalsPaginated`
 * parity). Decrypted IN the queryFn (PWA parity) — off the render path —
 * so the resolved page data is already plaintext by the time the screen
 * reads it.
 */
export type PaginatedJournals = {
  data: Journal[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export function useJournalsPaginated(limit = 20) {
  const epoch = journalDekEpoch();
  return useInfiniteQuery<PaginatedJournals>({
    queryKey: [...journalKeys.paginated(), epoch] as const,
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.get<PaginatedJournals>("/journals", {
        params: { page: pageParam as number, limit },
      });
      const dek = getJournalDek();
      const decrypted = dek
        ? await decryptJournalList(data.data, dek)
        : data.data;
      return { ...data, data: decrypted };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });
}

export function useJournal(id: string | null | undefined) {
  const qc = useQueryClient();
  const epoch = journalDekEpoch();
  return useQuery({
    queryKey: [
      ...(id ? journalKeys.detail(id) : journalKeys.detail("disabled")),
      epoch,
    ] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<Journal>(`/journals/${id}`);
      const dek = getJournalDek();
      return dek ? await decryptJournalEntry(data, dek) : data;
    },
    enabled: !!id,
    // Open instantly from the list caches the journal tab already loaded
    // (the paginated infinite list + any date-filtered flat list) instead of
    // spinning through a SECOND network round-trip for an entry we already
    // hold. List queryFns now decrypt too (Change 2 above), so the cached
    // list row is ALREADY plaintext — the seed below is safe to feed straight
    // into this (also-decrypting) detail query without a second decrypt pass.
    // A background refetch still runs to reconcile; we return the cached
    // object BY REFERENCE (never a copy) so the value stays referentially
    // stable. Deep-linked entries not present in any list cache fall back to
    // the network fetch (spinner).
    //
    // Prefix match: `journalKeys.lists()` is `[...all, "list"]`, and both
    // `journalKeys.list(filters)` and `journalKeys.paginated()` extend that
    // (`[...lists(), filters]` / `[...lists(), "paginated"]`) — appending the
    // trailing `epoch` element to each doesn't change their shared prefix, so
    // `getQueriesData({queryKey: journalKeys.lists()})` still matches every
    // list cache regardless of which epoch is baked into its key.
    placeholderData: () => {
      if (!id) return undefined;
      // Flat filtered lists cache Journal[]; the paginated cache (also under
      // lists()) is InfiniteData — the Array.isArray guard skips it here, and
      // it's searched separately below.
      // CURRENT EPOCH ONLY. The list caches are keyed `[...prefix, epoch]`, and
      // a prefix match returns every epoch still in the cache — including the
      // list fetched while the journal was LOCKED (no DEK → the queryFn
      // returned raw ciphertext), which outlives the unlock for gcTime and is
      // iterated FIRST (insertion order). Seeding from it painted the encrypted
      // blob in the reader for a beat before the real fetch replaced it (the
      // "blinking encrypted journal" after unlock, 2026-10-20).
      const isCurrentEpoch = (key: readonly unknown[]) =>
        key[key.length - 1] === epoch;
      const flat = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      for (const [key, list] of flat) {
        if (!isCurrentEpoch(key) || !Array.isArray(list)) continue;
        const hit = list.find((j) => j.id === id);
        if (hit) return hit;
      }
      const paged = qc.getQueriesData<{ pages: PaginatedJournals[] }>({
        queryKey: journalKeys.paginated(),
      });
      for (const [key, data] of paged) {
        if (!isCurrentEpoch(key)) continue;
        for (const page of data?.pages ?? []) {
          const hit = page?.data?.find((j) => j.id === id);
          if (hit) return hit;
        }
      }
      return undefined;
    },
  });
}

/**
 * 30-day journaling stats (per-day count/words + all-time baseline) —
 * feeds the dashboard's Journal Growth chart. `today` is the client's LOCAL
 * `yyyy-MM-dd` (PWA parity: `journalsApi.stats({ today })`) so the server
 * anchors the 30-day window on the user's local day, not UTC.
 */
export function useJournalStats(today?: string) {
  return useQuery({
    queryKey: [...journalKeys.stats(), { today }] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<JournalStats>("/journals/stats", {
        params: { today },
      });
      return data;
    },
  });
}

/**
 * Wide-window journaling stats for the dashboard writing-activity heatmap.
 * Separate query key from `useJournalStats` so the wider window never bloats
 * the 30-day cache. `days` (~190) covers the rolling 6-month grid.
 */
export function useJournalHeatmapStats(today?: string, days = 190) {
  return useQuery({
    queryKey: journalKeys.heatmap(days),
    queryFn: async () => {
      const { data } = await apiClient.get<JournalStats>("/journals/stats", {
        params: { today, days },
      });
      return data;
    },
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateJournalInput = {
  title?: string;
  // Dual-format like the PWA: TipTap JSON object (new entries) or legacy HTML
  // string. Encrypted inline before POST when the journal has a DEK.
  content: JournalContent;
  mood?: number;
  tags?: string[];
  /** yyyy-mm-dd. Server uses today when omitted. */
  date?: string;
};

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJournalInput) => {
      // CreateJournalDto requires title.min(1) AND date (yyyy-mm-dd) —
      // see apps/api/src/modules/journal/journal.dto.ts. Default both so
      // call sites don't need to pre-fill: title becomes the date label
      // (matches PWA's editor where the date is the title placeholder),
      // date falls back to today.
      const date = input.date ?? localDateKey();
      const title =
        input.title && input.title.trim().length > 0
          ? input.title.trim()
          : dateLabel(date);

      // END-TO-END ENCRYPTION — mirror the PWA's inline boundary
      // (apps/pwa/src/lib/api/journals.ts useCreateJournal): when a DEK is in
      // memory, encrypt title/content/tags (and stamp `encrypted:true` +
      // wordCount) BEFORE the POST so plaintext never hits the wire. When the
      // account has no encryption (no DEK), send the draft as-is.
      const dek = getJournalDek();
      // SECURITY: if encryption IS set up but no DEK is in memory (locked / a
      // status race on a cold start before checkJournalStatus resolves), refuse
      // rather than POST cleartext for an encryption-enabled account.
      if (!dek && isJournalEncryptionSetup()) {
        throw new Error(LOCKED_WRITE_MESSAGE);
      }
      const body = dek
        ? await encryptJournalPayload(
            {
              title,
              content: input.content,
              tags: input.tags,
              mood: input.mood,
              date,
            },
            dek,
          )
        : { ...input, title, date };

      const { data } = await apiClient.post<Journal>("/journals", body);
      return data;
    },
    onSuccess: (server) => {
      void qc.invalidateQueries({ queryKey: journalKeys.lists() });
      void qc.invalidateQueries({ queryKey: journalKeys.stats() });
      invalidateJournalMonth(qc, server?.date);
      // A new entry dated today changes the journal ring's word count.
      invalidateDashboardToday(qc);
      settleDerivedAggregates(qc, { dashboard: false });
    },
  });
}

function dateLabel(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type UpdateJournalInput = Partial<CreateJournalInput>;

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateJournalInput;
    }) => {
      // END-TO-END ENCRYPTION on edit — same boundary as useCreateJournal.
      // When a DEK is in memory AND the patch carries editable content (the
      // rich-editor save), encrypt title/content/tags (+ stamp encrypted:true)
      // before the PATCH so plaintext never hits the wire. A metadata-only
      // patch (no content) PATCHes as-is.
      const dek = getJournalDek();
      // SECURITY: refuse to PATCH cleartext when encryption is set up but the
      // journal is locked (no DEK) — same invariant as create.
      if (!dek && isJournalEncryptionSetup()) {
        throw new Error(LOCKED_WRITE_MESSAGE);
      }
      let body: UpdateJournalInput | Partial<EncryptedJournalPayload> = patch;
      if (dek && patch.content !== undefined) {
        const encrypted = await encryptJournalPayload(
          {
            title: patch.title ?? "",
            content: patch.content,
            tags: patch.tags,
            mood: patch.mood,
            date: patch.date,
          },
          dek,
        );
        // M2 (+ symmetric tags): a content-only PATCH must NOT overwrite the
        // stored title/tags — encryptJournalPayload coerces an absent title to
        // `""` and absent tags to `[]`, which would blank them. Drop any
        // encrypted field the patch didn't actually carry.
        const stripped: Partial<EncryptedJournalPayload> = { ...encrypted };
        if (patch.title === undefined) delete stripped.title;
        if (patch.tags === undefined) delete stripped.tags;
        body = stripped;
      }
      const { data } = await apiClient.patch<Journal>(`/journals/${id}`, body);
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: journalKeys.lists() });
      const snapshots = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        // The paginated cache under lists() holds InfiniteData ({pages}), not
        // Journal[] — skip it (PWA parity: Array.isArray guard) and let the
        // onSettled invalidate reconcile it.
        if (!Array.isArray(prev)) continue;
        qc.setQueryData<Journal[]>(
          key,
          prev.map((j) =>
            j.id === id
              ? { ...j, ...patch, updatedAt: new Date().toISOString() }
              : j,
          ),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    // Write the server entry into the caches instead of invalidating — autosave
    // must NEVER refetch ["journal", id] (journalKeys.detail): that would reload
    // the entry the user is actively typing in and can clobber the buffer.
    //
    // SECURITY: `server` is the RAW PATCH response — for an encrypted entry
    // that's still ciphertext (the server echoes back what it persisted). Now
    // that list/detail caches are decrypted-by-contract (queryFn decrypts on
    // fetch), writing `server` straight in would plant ciphertext where the
    // screen expects plaintext. Decrypt it first with the SAME in-memory DEK
    // used for the PATCH, then write the plaintext into the epoch-suffixed
    // detail key (matching the active useJournal query) and the list caches.
    onSuccess: async (server, vars) => {
      const dek = getJournalDek();
      const decryptedEntry = dek
        ? await decryptJournalEntry(server, dek)
        : server;
      const epoch = journalDekEpoch();
      qc.setQueryData([...journalKeys.detail(vars.id), epoch], decryptedEntry);
      const lists = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      for (const [key, list] of lists) {
        if (!Array.isArray(list)) continue;
        qc.setQueryData<Journal[]>(
          key,
          list.map((j) => (j.id === decryptedEntry.id ? decryptedEntry : j)),
        );
      }
      // The PAGINATED cache is InfiniteData ({pages}), so the Array.isArray
      // loop above skips it — patch it explicitly here. It used to be left for
      // "the onSettled invalidate" (see onMutate's comment) that never existed
      // on this mutation, which left the paginated list permanently showing
      // pre-edit rows. That stale row is what `useJournal`'s placeholderData
      // seeds the editor from, and since EntryEditor seeds its state via
      // useState initializers (no re-seed on refetch), the next keystroke would
      // autosave the STALE body back over the newer server copy — data loss.
      qc.setQueriesData<{ pages: PaginatedJournals[] }>(
        { queryKey: journalKeys.paginated() },
        (prev) => {
          if (!prev?.pages) return prev;
          return {
            ...prev,
            pages: prev.pages.map((page) =>
              Array.isArray(page?.data)
                ? {
                    ...page,
                    data: page.data.map((j) =>
                      j.id === decryptedEntry.id ? decryptedEntry : j,
                    ),
                  }
                : page,
            ),
          };
        },
      );
      // Journal words feed the Today ring; patch rather than invalidate —
      // autosave fires continuously while typing and a refetch per
      // keystroke-batch would hammer the aggregate.
      writeDashboardJournal(qc, decryptedEntry);
      // Autosave fires every ~1s while typing: the stats charts (Today's
      // growth + heatmap, both mounted) and the calendar month refetch ONCE
      // after typing pauses, not per save.
      invalidateDebounced(qc, journalKeys.stats());
      if (server?.date) {
        invalidateDebounced(qc, ["calendar", server.date.slice(0, 7)]);
      }
      settleDerivedAggregates(qc, { dashboard: false });
    },
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/journals/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: journalKeys.lists() });
      const snapshots = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      let date: string | undefined;
      for (const [key, prev] of snapshots) {
        // Skip the paginated InfiniteData cache — see useUpdateJournal.
        if (!Array.isArray(prev)) continue;
        date ??= prev.find((j) => j.id === id)?.date;
        qc.setQueryData<Journal[]>(
          key,
          prev.filter((j) => j.id !== id),
        );
      }
      date ??= qc.getQueryData<Journal>(journalKeys.detail(id))?.date;
      return { snapshots, date };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: (_id, _err, _vars, ctx) => {
      void qc.invalidateQueries({ queryKey: journalKeys.lists() });
      void qc.invalidateQueries({ queryKey: journalKeys.stats() });
      // Date unknown (entry only in the paged cache) → refresh every month.
      if (ctx?.date) invalidateJournalMonth(qc, ctx.date);
      else void qc.invalidateQueries({ queryKey: ["calendar"] });
      invalidateDashboardToday(qc);
      settleDerivedAggregates(qc, { dashboard: false });
    },
  });
}
