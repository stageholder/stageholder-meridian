// Journals data layer — ONLINE-ONLY.
//
// The offline feature (Dexie cache + mutation queue) was removed wholesale and
// will be rebuilt from scratch later. These hooks used to wrap the now-deleted
// `@repo/offline` helpers; this layer is now plain `@tanstack/react-query`.
// Every read hits the API; every write goes straight to the server.
//
// END-TO-END ENCRYPTION lives entirely in the ONLINE path here and is
// unchanged by the offline removal:
//   • READS decrypt right after the GET — `decryptJournalList` for list/
//     paginated responses, `decryptJournalResponse` for a single entry — before
//     the plaintext ever lands in the react-query cache.
//   • WRITES encrypt INLINE inside each mutationFn — `encryptJournalPayload`
//     runs before the POST/PATCH, then the server's (still-encrypted) response
//     is decrypted again before being returned/cached.
// The offline mutation queue used to re-encrypt deferred writes via the
// `register-transforms` payload transform; that transform is being deleted with
// the rest of the offline package. Because we are online-only now, the inline
// encryption in these mutationFns is the *only* encryption boundary and covers
// every write — nothing is deferred.
//
// When the offline rebuild lands it will reintroduce caching BEHIND these same
// hook names + signatures, so consumers should not need to change again.
import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import type { Journal, JournalContent, JournalStats } from "@repo/core/types";
import type { PaginatedJournals } from "@repo/core/api/journals";
import { tryGetCurrentUserSub } from "@/lib/current-user-sub";
import { lightKeys } from "./light";
import { todayLocal } from "@/lib/date";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import {
  encryptJournalPayload,
  decryptJournalResponse,
  decryptJournalList,
} from "@/lib/crypto/journal-crypto";
import { journalsApi } from "./clients";

export const journalKeys = {
  all: ["journals"] as const,
  stats: ["journals", "stats"] as const,
};

export function useJournalStats() {
  return useQuery<JournalStats>({
    queryKey: journalKeys.stats,
    queryFn: () => journalsApi.stats({ today: todayLocal() }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useJournals(
  params?: { startDate?: string; endDate?: string },
  options?: { enabled?: boolean },
) {
  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useQuery<Journal[]>({
    queryKey: ["journals", params],
    // Decrypt the whole page right after the GET — plaintext only ever lives in
    // the react-query cache, never the wire.
    queryFn: async () => {
      const journals = await journalsApi.list(params);
      if (dek) return decryptJournalList(journals, dek);
      return journals;
    },
    enabled: options?.enabled !== false && !isLocked,
  });
}

export function useJournalsPaginated(limit = 20) {
  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useInfiniteQuery<PaginatedJournals>({
    queryKey: ["journals", "paginated"],
    queryFn: async ({ pageParam }) => {
      const page = await journalsApi.listPaginated({
        page: pageParam as number,
        limit,
      });
      if (dek) {
        page.data = await decryptJournalList(page.data, dek);
      }
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    // Don't fetch while locked (encryption set up but no DEK): the GET would
    // return ciphertext the `if (dek)` branch can't decrypt, so the encrypted
    // blobs would be cached and rendered raw. Mirrors useJournals/useJournal.
    enabled: !isLocked,
  });
}

export function useJournal(id: string) {
  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useQuery<Journal>({
    queryKey: ["journal", id],
    // Decrypt the single entry right after the GET.
    queryFn: async () => {
      const journal = await journalsApi.get(id);
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    enabled: !!id && !isLocked,
  });
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const dek = useEncryptionStore((s) => s.dek);

  return useMutation<
    Journal,
    Error,
    {
      title: string;
      content: JournalContent;
      mood?: number;
      tags?: string[];
      date?: string;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >({
    mutationFn: async (data) => {
      // Encrypt INLINE before the POST, then decrypt the server's response
      // before it enters the cache.
      const payload = dek ? await encryptJournalPayload(data, dek) : data;
      const journal = await journalsApi.create(payload);
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
        exact: false,
      });

      const optimisticJournal: Journal = {
        id: `temp-${Date.now()}`,
        userSub: tryGetCurrentUserSub() ?? "",
        authorId: "",
        title: newData.title,
        content: newData.content,
        mood: newData.mood,
        tags: newData.tags ?? [],
        date: newData.date ?? todayLocal(),
        wordCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      for (const [queryKey, data] of previousQueries) {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Journal[]>(queryKey, [
            optimisticJournal,
            ...data,
          ]);
        }
      }

      return { previousQueries };
    },
    onError: (_err, _data, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: lightKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: journalKeys.stats });
    },
  });
}

export function useUpdateJournal() {
  const queryClient = useQueryClient();
  const dek = useEncryptionStore((s) => s.dek);

  return useMutation<
    Journal,
    Error,
    {
      id: string;
      data: {
        title?: string;
        content?: JournalContent;
        mood?: number;
        tags?: string[];
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >({
    mutationFn: async ({ id, data }) => {
      // Encrypt INLINE before the PATCH, then decrypt the server's response.
      const payload = dek
        ? await encryptJournalPayload(
            {
              title: data.title || "",
              content: data.content || "",
              tags: data.tags,
              mood: data.mood,
            },
            dek,
          )
        : data;
      const journal = await journalsApi.update(id, payload);
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });
      await queryClient.cancelQueries({ queryKey: ["journal", id] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
        exact: false,
      });

      const previousDetail = queryClient.getQueryData<Journal>(["journal", id]);

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(
            queryKey,
            old.map((j) =>
              j.id === id
                ? { ...j, ...data, updatedAt: new Date().toISOString() }
                : j,
            ),
          );
        }
      }

      queryClient.setQueryData<Journal>(["journal", id], (old) =>
        old ? { ...old, ...data, updatedAt: new Date().toISOString() } : old,
      );

      return { previousQueries, previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          ["journal", variables.id],
          context.previousDetail,
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      void queryClient.invalidateQueries({
        queryKey: ["journal", variables.id],
      });
      // Editing a journal changes its word count, which feeds the daily
      // journal-progress ring and the XP system (UserLight). Invalidate the
      // gamification queries too, or the ring shows the pre-edit state for up
      // to the default staleTime while the entry page already reflects the edit.
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: lightKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: journalKeys.stats });
    },
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >({
    mutationFn: (id) => journalsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
        exact: false,
      });

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(
            queryKey,
            old.filter((j) => j.id !== id),
          );
        }
      }

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      // Deleting a journal changes the aggregate word count that feeds the
      // daily journal-progress ring and XP system (UserLight), so refresh the
      // gamification queries too — otherwise the ring stays stale after a delete.
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: lightKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: journalKeys.stats });
    },
  });
}
