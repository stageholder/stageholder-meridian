import { useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index';
import { enqueue } from '../sync/mutation-queue';
import { useNetworkStatus } from '../network/index';

interface SyncableEntity {
  id: string;
}

export function useOfflineQuery<T extends SyncableEntity>(
  queryKey: unknown[],
  table: EntityTable<T, 'id'>,
  fetchFn: () => Promise<T[]>,
  options?: Partial<UseQueryOptions<T[]>>,
) {
  const isOnline = useNetworkStatus();
  const localData = useLiveQuery(() => table.toArray(), [table]) ?? [];

  const query = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const data = await fetchFn();
      await db.transaction('rw', table, async () => {
        for (const item of data) {
          await table.put(item);
        }
      });
      return data;
    },
    enabled: isOnline && (options?.enabled !== false),
    ...options,
  });

  return {
    ...query,
    data: query.data ?? localData,
    isOffline: !isOnline,
  };
}

export function useOfflineMutation<TData extends SyncableEntity, TVariables>(
  options: UseMutationOptions<TData, Error, TVariables> & {
    table: EntityTable<TData, 'id'>;
    entityType: string;
    buildPath: (variables: TVariables) => string;
    operation: 'create' | 'update' | 'delete';
    invalidateKeys?: unknown[][];
  },
) {
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      if (isOnline && options.mutationFn) {
        const result = await options.mutationFn(variables, {} as never);
        await options.table.put(result);
        return result;
      }

      const path = options.buildPath(variables);

      if (options.operation === 'delete') {
        const id = (variables as Record<string, unknown>).id;
        if (id) await options.table.delete(id as never);
      } else {
        const optimistic = {
          id: crypto.randomUUID(),
          ...variables,
        } as unknown as TData;
        await options.table.put(optimistic);
      }

      await enqueue({
        entityType: options.entityType,
        entityId: String((variables as Record<string, unknown>).id ?? ''),
        operation: options.operation,
        path,
        payload: variables,
      });

      return {} as TData;
    },
    onSuccess: (...args) => {
      options.invalidateKeys?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      options.onSuccess?.(...args);
    },
    onError: options.onError,
  });
}

export function usePendingCount(): number {
  const count = useLiveQuery(
    () =>
      db.pendingMutations.where('status').anyOf('pending', 'failed').count(),
    [],
  );
  return count ?? 0;
}

export function useAutoSync(
  syncFn: () => Promise<void>,
  intervalMs = 60000,
) {
  const isOnline = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) return;

    syncFn();

    const handleOnline = () => { syncFn(); };
    window.addEventListener('online', handleOnline);

    const id = setInterval(() => {
      if (navigator.onLine) syncFn();
    }, intervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(id);
    };
  }, [isOnline, syncFn, intervalMs]);
}
