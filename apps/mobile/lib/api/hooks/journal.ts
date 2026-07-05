// apps/mobile/lib/api/hooks/journal.ts
//
// React Query hooks for /journals. Aligned with @repo/core/types — fields
// are `title`, `content`, `date` (yyyy-mm-dd), `wordCount` (server-computed),
// `tags` (string[] or comma-string per server normalization).
//
// EntryEditor autosave hammers useUpdateJournal — onSettled invalidates
// lazily so we don't thrash the network on every keystroke.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Journal, JournalContent, JournalStats } from "@repo/core/types";

import { apiClient } from "../client";
import { journalKeys } from "../keys";
import {
  encryptJournalPayload,
  getJournalDek,
  isJournalEncryptionSetup,
  type EncryptedJournalPayload,
} from "@/lib/journal-crypto";

// Thrown (and surfaced by the autosave hook's error status) instead of ever
// sending cleartext when encryption is configured but the journal is locked —
// the "never write plaintext when encryption is set up" invariant.
const LOCKED_WRITE_MESSAGE =
  "Journal is locked — unlock it before saving so entries aren't stored unencrypted.";

/* ------------------------------ Reads -------------------------------- */

export function useJournals(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: journalKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Journal[] } | Journal[]>(
        "/journals",
        { params: filters },
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export function useJournal(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? journalKeys.detail(id) : journalKeys.detail("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<Journal>(`/journals/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useJournalStats(today?: boolean) {
  return useQuery({
    queryKey: [...journalKeys.stats(), { today }] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<JournalStats>("/journals/stats", {
        params: { today: today ? true : undefined },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: journalKeys.lists() }),
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
        if (!prev) continue;
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
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      if (vars) qc.invalidateQueries({ queryKey: journalKeys.detail(vars.id) });
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
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Journal[]>(
          key,
          prev.filter((j) => j.id !== id),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.lists() }),
  });
}
