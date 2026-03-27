import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/index";
import { enqueue } from "../sync/mutation-queue";
import { useNetworkStatus } from "../network/index";

interface SyncableEntity {
  id: string;
}

// --- Query Hooks ---

export function useOfflineQuery<T extends SyncableEntity>(
  queryKey: unknown[],
  table: EntityTable<T, "id">,
  fetchFn: () => Promise<T[]>,
  options?: Partial<UseQueryOptions<T[]>>,
) {
  const isOnline = useNetworkStatus();
  const localData = useLiveQuery(() => table.toArray(), [table]) ?? [];

  const query = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const data = await fetchFn();
      await db.transaction("rw", table, async () => {
        for (const item of data) {
          await table.put(item);
        }
      });
      return data;
    },
    enabled: isOnline && options?.enabled !== false,
    ...options,
  });

  return {
    ...query,
    data: query.data ?? localData,
    isOffline: !isOnline,
  };
}

export function useOfflineQuerySingle<T extends SyncableEntity>(
  queryKey: unknown[],
  table: EntityTable<T, "id">,
  id: string,
  fetchFn: () => Promise<T>,
  options?: Partial<UseQueryOptions<T>>,
) {
  const isOnline = useNetworkStatus();
  const localData = useLiveQuery(() => table.get(id as any), [table, id]);

  const query = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const data = await fetchFn();
      await table.put(data);
      return data;
    },
    enabled: isOnline && options?.enabled !== false,
    ...options,
  });

  return {
    ...query,
    data: query.data ?? localData ?? undefined,
    isOffline: !isOnline,
  };
}

export function useOfflineQueryFiltered<T extends SyncableEntity>(
  queryKey: unknown[],
  localQueryFn: () => Promise<T[]>,
  fetchFn: () => Promise<T[]>,
  table: EntityTable<T, "id">,
  options?: Partial<UseQueryOptions<T[]>>,
) {
  const isOnline = useNetworkStatus();
  const localData = useLiveQuery(() => localQueryFn(), [localQueryFn]) ?? [];

  const query = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const data = await fetchFn();
      await db.transaction("rw", table, async () => {
        for (const item of data) {
          await table.put(item);
        }
      });
      return data;
    },
    enabled: isOnline && options?.enabled !== false,
    ...options,
  });

  return {
    ...query,
    data: query.data ?? localData,
    isOffline: !isOnline,
  };
}

// --- Mutation Hooks ---

export function useOfflineMutation<
  TData extends SyncableEntity,
  TVariables,
  TContext = unknown,
>(
  options: Omit<
    UseMutationOptions<TData, Error, TVariables, TContext>,
    "mutationFn"
  > & {
    mutationFn: (variables: TVariables) => Promise<TData>;
    table: EntityTable<TData, "id">;
    entityType: string;
    buildPath: (variables: TVariables) => string;
    operation: "create" | "update";
    invalidateKeys?: unknown[][];
  },
) {
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: async (variables) => {
      if (isOnline) {
        const result = await options.mutationFn(variables);
        await options.table.put(result);
        return result;
      }

      const path = options.buildPath(variables);
      const tempId = crypto.randomUUID();

      const optimistic = {
        id: tempId,
        ...variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as TData;
      await options.table.put(optimistic);

      await enqueue({
        entityType: options.entityType,
        entityId:
          options.operation === "update"
            ? String((variables as Record<string, unknown>).id ?? "")
            : "",
        operation: options.operation,
        path,
        payload: variables,
        tempId: options.operation === "create" ? tempId : undefined,
      });

      return optimistic;
    },
    onMutate: isOnline ? options.onMutate : undefined,
    onSuccess: (...args) => {
      options.invalidateKeys?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      options.onSuccess?.(...args);
    },
    onError: options.onError,
    onSettled: options.onSettled,
  });
}

export function useOfflineDeleteMutation<TVariables>(
  options: Omit<UseMutationOptions<void, Error, TVariables>, "mutationFn"> & {
    mutationFn: (variables: TVariables) => Promise<void>;
    table: EntityTable<SyncableEntity, "id">;
    entityType: string;
    buildPath: (variables: TVariables) => string;
    getEntityId: (variables: TVariables) => string;
    invalidateKeys?: unknown[][];
  },
) {
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation<void, Error, TVariables>({
    mutationFn: async (variables) => {
      const entityId = options.getEntityId(variables);

      if (isOnline) {
        await options.mutationFn(variables);
        await options.table.delete(entityId as never);
        return;
      }

      await options.table.delete(entityId as never);

      await enqueue({
        entityType: options.entityType,
        entityId,
        operation: "delete",
        path: options.buildPath(variables),
        payload: variables,
      });
    },
    onMutate: isOnline ? options.onMutate : undefined,
    onSuccess: (...args) => {
      options.invalidateKeys?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      options.onSuccess?.(...args);
    },
    onError: options.onError,
    onSettled: options.onSettled,
  });
}

// --- Utility Hooks ---

export function usePendingCount(): number {
  const count = useLiveQuery(
    () =>
      db.pendingMutations.where("status").anyOf("pending", "failed").count(),
    [],
  );
  return count ?? 0;
}

export function useFailedMutations() {
  const mutations = useLiveQuery(
    () => db.pendingMutations.where("status").equals("failed").toArray(),
    [],
  );
  return mutations ?? [];
}

export function useAutoSync(
  syncFn: () => Promise<void>,
  options: {
    intervalMs?: number;
    isOnline?: boolean;
    waitForRefresh?: () => Promise<void>;
  } = {},
) {
  const {
    intervalMs = 60000,
    isOnline: isOnlineOverride,
    waitForRefresh,
  } = options;
  const browserOnline = useNetworkStatus();
  const isOnline = isOnlineOverride ?? browserOnline;

  // Immediate flush on mount if browser reports online
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncFn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    const guardedSync = async () => {
      if (waitForRefresh) {
        try {
          await waitForRefresh();
        } catch {
          return;
        }
      }
      syncFn();
    };

    guardedSync();

    window.addEventListener("online", guardedSync);

    const id = setInterval(guardedSync, intervalMs);

    return () => {
      window.removeEventListener("online", guardedSync);
      clearInterval(id);
    };
  }, [isOnline, syncFn, intervalMs, waitForRefresh]);
}

export function useSyncOnFocus(
  syncFn: () => Promise<void>,
  options?: { waitForRefresh?: () => Promise<void> },
) {
  const { waitForRefresh } = options ?? {};

  useEffect(() => {
    const handleFocus = async () => {
      if (waitForRefresh) {
        try {
          await waitForRefresh();
        } catch {
          return;
        }
      }
      syncFn();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [syncFn, waitForRefresh]);
}
