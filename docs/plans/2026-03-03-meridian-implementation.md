# Meridian Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-platform personal productivity app (todo, journal, habit tracker) with offline-first sync, mirroring the DDD architecture from stageholder-atlas.

**Architecture:** NestJS backend with DDD patterns (Entity base, Result type, Repository pattern) backed by MongoDB. Offline-first frontend using Dexie (IndexedDB) with mutation queue and sync manager. Single Next.js PWA frontend wrapped by Tauri for desktop/mobile. Turborepo monorepo with shared packages for types, API client, offline infrastructure, and UI components.

**Tech Stack:** Turborepo + Bun, NestJS 11, MongoDB + Mongoose, Next.js 16, React 19, shadcn/ui (new-york style), Dexie 4, Zustand 5, TanStack React Query 5, Tiptap, Zod, Vitest, Playwright

**Reference:** ~/stageholder-atlas contains the reference implementation for all patterns used here.

---

## Phase 1: Monorepo Foundation

### Task 1.1: Restructure apps directory — rename web to pwa

The current turborepo has `apps/web` (Next.js) and `apps/docs` (Next.js). Rename `apps/web` to `apps/pwa` and update all references.

**Files:**
- Rename: `apps/web/` → `apps/pwa/`
- Modify: `apps/pwa/package.json` (update name)

**Step 1: Rename the directory**

```bash
mv apps/web apps/pwa
```

**Step 2: Update the package name in apps/pwa/package.json**

Change `"name": "web"` to `"name": "pwa"`.

**Step 3: Run bun install to update lockfile**

```bash
bun install
```

**Step 4: Verify the build still works**

```bash
bun run build
```
Expected: Build succeeds for both apps.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename apps/web to apps/pwa"
```

---

### Task 1.2: Create the NestJS API app

Set up `apps/api` as a NestJS application matching the atlas pattern.

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/.env.example`

**Step 1: Create apps/api/package.json**

```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch -b swc",
    "build": "nest build -b swc",
    "start": "nest start -b swc",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/mongoose": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/throttler": "^6.5.0",
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "express": "^5.2.1",
    "google-auth-library": "^10.5.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^8.9.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@swc/cli": "^0.6.0",
    "@swc/core": "^1.10.0",
    "@types/bcryptjs": "^3.0.0",
    "@types/cookie-parser": "^1.4.10",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create apps/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create apps/api/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "swc",
    "typeCheck": true
  }
}
```

**Step 4: Create apps/api/src/main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function parseOrigins(raw: string | undefined): string | string[] {
  if (!raw) return 'http://localhost:3000';
  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok' });
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: parseOrigins(process.env.FRONTEND_URL),
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Meridian API running on http://localhost:${port}`);
}

bootstrap();
```

**Step 5: Create apps/api/src/app.module.ts** (minimal for now)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
  ],
})
export class AppModule {}
```

**Step 6: Create apps/api/.env.example**

```
MONGODB_URI=mongodb://localhost:27017/meridian
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-refresh-secret
FRONTEND_URL=http://localhost:3000
PORT=4000
GOOGLE_CLIENT_ID=your-google-client-id
```

**Step 7: Update turbo.json to include api build outputs**

Add `"dist/**"` to build outputs alongside `.next/**`.

In `turbo.json`, change:
```json
"outputs": [".next/**", "!.next/cache/**"]
```
to:
```json
"outputs": [".next/**", "!.next/cache/**", "dist/**"]
```

**Step 8: Install dependencies and verify**

```bash
bun install
cd apps/api && cp .env.example .env
```

**Step 9: Commit**

```bash
git add apps/api/ turbo.json
git commit -m "feat: add NestJS API app scaffold"
```

---

### Task 1.3: Create packages/core shared package

Set up `packages/core` for shared types, API client, and stores — matching the atlas `@stageholder-atlas/core` package.

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types/index.ts`
- Create: `packages/core/src/platform/index.ts`

**Step 1: Create packages/core/package.json**

```json
{
  "name": "@repo/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check-types": "tsc --noEmit",
    "lint": "eslint"
  },
  "exports": {
    "./types": "./src/types/index.ts",
    "./types/*": "./src/types/*.ts",
    "./api/*": "./src/api/*.ts",
    "./stores/*": "./src/stores/*.ts",
    "./platform": "./src/platform/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "dependencies": {
    "axios": "^1.7.9",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "@types/react": "^19",
    "typescript": "^5"
  }
}
```

**Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "paths": {
      "@repo/core/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create packages/core/src/platform/index.ts**

```typescript
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PlatformConfig {
  apiBaseUrl: string;
  authStrategy: 'cookie' | 'bearer';
  storage: StorageAdapter;
  navigate?: (path: string) => void;
  onLogout?: () => void;
}

export function detectPlatform(): 'web' | 'desktop' {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'desktop';
  }
  return 'web';
}

export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
}
```

**Step 4: Create packages/core/src/types/index.ts** (placeholder — will be populated per module)

```typescript
export type { AuthUser } from './auth';
export type { Workspace, WorkspaceMember } from './workspace';
```

**Step 5: Create packages/core/src/types/auth.ts**

```typescript
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  timezone?: string;
  provider: string;
  emailVerified: boolean;
  createdAt: string;
}
```

**Step 6: Create packages/core/src/types/workspace.ts**

```typescript
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId?: string;
  email: string;
  role: string;
  invitationStatus: string;
  createdAt: string;
}
```

**Step 7: Install and verify**

```bash
bun install
```

**Step 8: Commit**

```bash
git add packages/core/
git commit -m "feat: add packages/core with shared types and platform abstraction"
```

---

### Task 1.4: Create packages/offline shared package

Set up `packages/offline` for Dexie database, sync manager, and mutation queue.

**Files:**
- Create: `packages/offline/package.json`
- Create: `packages/offline/tsconfig.json`
- Create: `packages/offline/src/db/index.ts`
- Create: `packages/offline/src/sync/mutation-queue.ts`
- Create: `packages/offline/src/sync/sync-manager.ts`
- Create: `packages/offline/src/network/index.ts`
- Create: `packages/offline/src/hooks/index.ts`

**Step 1: Create packages/offline/package.json**

```json
{
  "name": "@repo/offline",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check-types": "tsc --noEmit",
    "lint": "eslint"
  },
  "exports": {
    "./db": "./src/db/index.ts",
    "./sync/*": "./src/sync/*.ts",
    "./network": "./src/network/index.ts",
    "./hooks": "./src/hooks/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "@repo/core": "*",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.0.0"
  },
  "dependencies": {
    "dexie": "^4.0.11",
    "dexie-react-hooks": "^1.1.7"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "@repo/core": "*",
    "@tanstack/react-query": "^5.62.0",
    "@types/react": "^19",
    "axios": "^1.7.9",
    "react": "^19.1.0",
    "typescript": "^5"
  }
}
```

**Step 2: Create packages/offline/tsconfig.json**

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "paths": {
      "@repo/offline/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create packages/offline/src/db/index.ts**

```typescript
import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Workspace,
  WorkspaceMember,
} from '@repo/core/types';

// Domain types will be imported as modules are built.
// For now, define inline interfaces that will be replaced.

export interface TodoList {
  id: string;
  workspaceId: string;
  name: string;
  color?: string;
  icon?: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assigneeId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Journal {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  targetCount: number;
  unit?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  workspaceId: string;
  date: string;
  value: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  workspaceId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

export interface PendingMutation {
  id?: number;
  timestamp: number;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  path: string;
  payload: unknown;
  retryCount: number;
  status: 'pending' | 'in-flight' | 'failed';
}

export interface SyncMeta {
  entityType: string;
  workspaceId: string;
  lastSyncedAt: string;
}

class MeridianDB extends Dexie {
  workspaces!: EntityTable<Workspace, 'id'>;
  members!: EntityTable<WorkspaceMember, 'id'>;
  todoLists!: EntityTable<TodoList, 'id'>;
  todos!: EntityTable<Todo, 'id'>;
  journals!: EntityTable<Journal, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitEntries!: EntityTable<HabitEntry, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  notifications!: EntityTable<AppNotification, 'id'>;
  pendingMutations!: EntityTable<PendingMutation, 'id'>;
  syncMeta!: Table<SyncMeta, [string, string]>;

  constructor() {
    super('meridian');

    this.version(1).stores({
      workspaces: 'id, ownerId',
      members: 'id, workspaceId, userId',
      todoLists: 'id, workspaceId',
      todos: 'id, workspaceId, listId, status, assigneeId, dueDate',
      journals: 'id, workspaceId, date',
      habits: 'id, workspaceId',
      habitEntries: 'id, habitId, workspaceId, date, [habitId+date]',
      tags: 'id, workspaceId',
      notifications: 'id, workspaceId, recipientId, read',
      pendingMutations: '++id, entityType, status, timestamp',
      syncMeta: '[entityType+workspaceId]',
    });
  }
}

export const db = new MeridianDB();
```

**Step 4: Create packages/offline/src/sync/mutation-queue.ts**

```typescript
import type { AxiosInstance } from 'axios';
import { db, type PendingMutation } from '@repo/offline/db';

const MAX_RETRIES = 5;

export async function enqueue(
  mutation: Omit<PendingMutation, 'id' | 'retryCount' | 'status' | 'timestamp'>,
): Promise<void> {
  await db.pendingMutations.add({
    ...mutation,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  });
}

export async function flush(
  client: AxiosInstance,
): Promise<{ success: number; failed: number }> {
  const pending = await db.pendingMutations
    .where('status')
    .anyOf('pending', 'failed')
    .sortBy('timestamp');

  let success = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (mutation.retryCount >= MAX_RETRIES) continue;

    try {
      await db.pendingMutations.update(mutation.id!, { status: 'in-flight' });

      switch (mutation.operation) {
        case 'create':
          await client.post(mutation.path, mutation.payload);
          break;
        case 'update':
          await client.patch(mutation.path, mutation.payload);
          break;
        case 'delete':
          await client.delete(mutation.path);
          break;
      }

      await db.pendingMutations.delete(mutation.id!);
      success++;
    } catch {
      await db.pendingMutations.update(mutation.id!, {
        status: 'failed',
        retryCount: mutation.retryCount + 1,
      });
      failed++;
    }
  }

  return { success, failed };
}

export async function getPendingCount(): Promise<number> {
  return db.pendingMutations.where('status').anyOf('pending', 'failed').count();
}

export async function clear(): Promise<void> {
  await db.pendingMutations.clear();
}
```

**Step 5: Create packages/offline/src/sync/sync-manager.ts**

```typescript
import type { AxiosInstance } from 'axios';
import type { EntityTable } from 'dexie';
import { db } from '@repo/offline/db';
import { flush } from './mutation-queue';

interface SyncableEntity {
  id: string;
  updatedAt?: string;
}

let syncing = false;

export async function syncEntity<T extends SyncableEntity>(
  entityType: string,
  workspaceId: string,
  table: EntityTable<T, 'id'>,
  fetchFn: () => Promise<T[]>,
): Promise<void> {
  const serverData = await fetchFn();

  await db.transaction('rw', table, db.syncMeta, async () => {
    for (const item of serverData) {
      const local = await table.get({ id: item.id } as never);

      if (!local) {
        await table.put(item);
      } else {
        const localUpdated = (local as SyncableEntity).updatedAt;
        const serverUpdated = item.updatedAt;
        if (serverUpdated && localUpdated && serverUpdated >= localUpdated) {
          await table.put(item);
        }
      }
    }

    await db.syncMeta.put({
      entityType,
      workspaceId,
      lastSyncedAt: new Date().toISOString(),
    });
  });
}

export async function fullSync(
  workspaceId: string,
  client: AxiosInstance,
  fetchers: Record<string, () => Promise<SyncableEntity[]>>,
  tables: Record<string, EntityTable<SyncableEntity, 'id'>>,
): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    await flush(client);

    for (const [entityType, fetchFn] of Object.entries(fetchers)) {
      const table = tables[entityType];
      if (table) {
        await syncEntity(entityType, workspaceId, table, fetchFn);
      }
    }
  } finally {
    syncing = false;
  }
}

export function isSyncing(): boolean {
  return syncing;
}
```

**Step 6: Create packages/offline/src/network/index.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useNetworkStatusWithHeartbeat(
  healthUrl: string,
  intervalMs = 30000,
): boolean {
  const browserOnline = useNetworkStatus();
  const [apiReachable, setApiReachable] = useState(browserOnline);

  const checkHealth = useCallback(async () => {
    if (!browserOnline) {
      setApiReachable(false);
      return;
    }
    try {
      const res = await fetch(healthUrl, { method: 'HEAD', cache: 'no-store' });
      setApiReachable(res.ok);
    } catch {
      setApiReachable(false);
    }
  }, [browserOnline, healthUrl]);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, intervalMs);
    return () => clearInterval(id);
  }, [checkHealth, intervalMs]);

  return apiReachable;
}
```

**Step 7: Create packages/offline/src/hooks/index.ts**

```typescript
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
import { db } from '@repo/offline/db';
import { enqueue } from '@repo/offline/sync/mutation-queue';
import { useNetworkStatus } from '@repo/offline/network';

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
```

**Step 8: Install and verify**

```bash
bun install
```

**Step 9: Commit**

```bash
git add packages/offline/
git commit -m "feat: add packages/offline with Dexie DB, sync manager, and mutation queue"
```

---

## Phase 2: Backend Shared Infrastructure

### Task 2.1: Create shared DDD building blocks

Port the atlas shared infrastructure (Entity base, Result type, pagination, ID utils) to Meridian's API.

**Files:**
- Create: `apps/api/src/shared/entity.base.ts`
- Create: `apps/api/src/shared/result.ts`
- Create: `apps/api/src/shared/pagination.ts`
- Create: `apps/api/src/shared/id.utils.ts`
- Create: `apps/api/src/shared/index.ts`

**Step 1: Create apps/api/src/shared/id.utils.ts**

```typescript
import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}
```

**Step 2: Create apps/api/src/shared/result.ts**

```typescript
export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type AsyncResult<T, E extends Error = Error> = Promise<Result<T, E>>;

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

**Step 3: Create apps/api/src/shared/entity.base.ts**

```typescript
import { generateId } from './id.utils';

export interface EntityProps {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export abstract class Entity<T extends EntityProps> {
  protected readonly props: T;
  private readonly _id: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | undefined;

  protected constructor(props: T, id?: string) {
    this._id = id || props.id || generateId();
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._deletedAt = props.deletedAt;
    this.props = { ...props, id: this._id };
  }

  get id(): string { return this._id; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | undefined { return this._deletedAt; }
  get isDeleted(): boolean { return !!this._deletedAt; }

  protected touch(): void { this._updatedAt = new Date(); }

  softDelete(): void { this._deletedAt = new Date(); this.touch(); }
  restore(): void { this._deletedAt = undefined; this.touch(); }

  public equals(entity?: Entity<T>): boolean {
    if (!entity) return false;
    if (!(entity instanceof Entity)) return false;
    return this._id === entity._id;
  }

  protected get<K extends keyof T>(key: K): T[K] { return this.props[key]; }

  protected set<K extends keyof T>(key: K, value: T[K]): void {
    this.props[key] = value;
    this.touch();
  }

  public toObject(): T & { id: string; createdAt: Date; updatedAt: Date; deletedAt?: Date } {
    return {
      ...this.props,
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt,
    };
  }
}
```

**Step 4: Create apps/api/src/shared/pagination.ts**

```typescript
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
```

**Step 5: Create apps/api/src/shared/index.ts**

```typescript
export { Entity, EntityProps } from './entity.base';
export { Result, AsyncResult, Ok, Err } from './result';
export { generateId } from './id.utils';
export {
  PaginationParams,
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from './pagination';
```

**Step 6: Commit**

```bash
git add apps/api/src/shared/
git commit -m "feat(api): add shared DDD building blocks (Entity, Result, pagination)"
```

---

### Task 2.2: Create common guards, decorators, and pipes

Port the atlas common infrastructure for auth guards, decorators, and Zod validation.

**Files:**
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/common/guards/workspace-member.guard.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/public.decorator.ts`
- Create: `apps/api/src/common/zod-validation.pipe.ts`
- Create: `apps/api/src/common/utils/auth-cookies.util.ts`

**Step 1: Create apps/api/src/common/decorators/current-user.decorator.ts**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.sub;
  },
);
```

**Step 2: Create apps/api/src/common/decorators/public.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Step 3: Create apps/api/src/common/guards/jwt-auth.guard.ts**

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      const payload = jwt.verify(token, this.jwtSecret);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | null {
    const cookieToken = request.cookies?.access_token;
    if (cookieToken) return cookieToken;
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
  }
}
```

**Step 4: Create apps/api/src/common/guards/workspace-member.guard.ts**

```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { WorkspaceMemberService } from '../../modules/workspace-member/workspace-member.service';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly memberService: WorkspaceMemberService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const workspaceId = request.params?.workspaceId;
    if (!userId || !workspaceId) throw new ForbiddenException('Workspace access denied');
    const isMember = await this.memberService.isMember(workspaceId, userId);
    if (!isMember) throw new ForbiddenException('Not a member of this workspace');
    request.workspaceId = workspaceId;
    return true;
  }
}
```

Note: Fix `ctx` → `context` in the guard above.

**Step 5: Create apps/api/src/common/zod-validation.pipe.ts**

```typescript
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }
  }
}
```

**Step 6: Create apps/api/src/common/utils/auth-cookies.util.ts**

```typescript
import { Response, Request } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('strict' as const) : ('lax' as const),
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/v1/auth' });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
}

export function getRefreshTokenFromCookie(req: Request): string | undefined {
  return req.cookies?.refresh_token;
}
```

**Step 7: Commit**

```bash
git add apps/api/src/common/
git commit -m "feat(api): add common guards, decorators, and validation pipe"
```

---

## Phase 3: Auth & User Backend Modules

### Task 3.1: Create User module (entity, schema, repository, service)

**Files:**
- Create: `apps/api/src/modules/user/user.entity.ts`
- Create: `apps/api/src/modules/user/user.schema.ts`
- Create: `apps/api/src/modules/user/user.repository.ts`
- Create: `apps/api/src/modules/user/user.service.ts`
- Create: `apps/api/src/modules/user/user.module.ts`

Follow the exact atlas patterns for User entity. See reference: `~/stageholder-atlas/apps/api/src/modules/user/`

The User entity has: email, name, passwordHash, provider ('local'|'google'), providerId, emailVerified, avatar, timezone.

**Step 1:** Create each file following atlas patterns (entity → schema → repository → service → module). The entity uses `Entity<UserProps>` base class, static `create()` and `reconstitute()` methods. Schema uses Mongoose with `@Prop` decorators, UUID `_id`, and `created_at`/`updated_at` timestamps. Repository maps between domain and persistence with `toDomain()`. Service provides `createLocal()`, `findByEmail()`, `findById()`, `findOrCreateGoogle()`.

**Step 2: Commit**

```bash
git add apps/api/src/modules/user/
git commit -m "feat(api): add User module (entity, schema, repository, service)"
```

---

### Task 3.2: Create Auth module (service, controller, DTOs)

**Files:**
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.dto.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`

Follow the atlas auth module pattern. Endpoints:
- `POST /auth/register` (Public) — register with email/password
- `POST /auth/login` (Public) — login with email/password
- `POST /auth/social` (Public) — Google OAuth login
- `POST /auth/refresh` (Public) — refresh token rotation
- `POST /auth/logout` — logout (revoke refresh token)
- `GET /auth/me` — get current user profile
- `PATCH /auth/me` — update profile

Auth service handles JWT token generation (access + refresh), bcrypt password hashing, Google ID token verification, refresh token rotation with SHA256 hashing stored in User schema.

**Step 1:** Create each file following atlas patterns.

**Step 2: Commit**

```bash
git add apps/api/src/modules/auth/
git commit -m "feat(api): add Auth module with JWT, Google OAuth, and refresh tokens"
```

---

### Task 3.3: Create Workspace and WorkspaceMember modules

**Files:**
- Create: `apps/api/src/modules/workspace/workspace.entity.ts`
- Create: `apps/api/src/modules/workspace/workspace.schema.ts`
- Create: `apps/api/src/modules/workspace/workspace.repository.ts`
- Create: `apps/api/src/modules/workspace/workspace.service.ts`
- Create: `apps/api/src/modules/workspace/workspace.controller.ts`
- Create: `apps/api/src/modules/workspace/workspace.dto.ts`
- Create: `apps/api/src/modules/workspace/workspace.module.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.entity.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.schema.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.repository.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.service.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.controller.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.dto.ts`
- Create: `apps/api/src/modules/workspace-member/workspace-member.module.ts`

Direct port from atlas. Workspace has: name, slug (auto-generated), description, ownerId. WorkspaceMember has: workspaceId, userId, email, role ('owner'|'admin'|'member'|'viewer'), invitationStatus, invitationToken.

**Step 1:** Create all files following atlas patterns exactly.

**Step 2: Wire up modules in app.module.ts**

Update `apps/api/src/app.module.ts` to import UserModule, AuthModule, WorkspaceModule, WorkspaceMemberModule and add JwtAuthGuard + ThrottlerGuard as APP_GUARDs.

**Step 3: Commit**

```bash
git add apps/api/src/modules/ apps/api/src/app.module.ts
git commit -m "feat(api): add Workspace and WorkspaceMember modules"
```

---

## Phase 4: Domain Modules (Backend)

### Task 4.1: Create Tag module

**Files:**
- Create: `apps/api/src/modules/tag/tag.entity.ts`
- Create: `apps/api/src/modules/tag/tag.schema.ts`
- Create: `apps/api/src/modules/tag/tag.repository.ts`
- Create: `apps/api/src/modules/tag/tag.service.ts`
- Create: `apps/api/src/modules/tag/tag.controller.ts`
- Create: `apps/api/src/modules/tag/tag.dto.ts`
- Create: `apps/api/src/modules/tag/tag.module.ts`

Tag entity: name, color, workspaceId. Controller scoped under `/workspaces/:workspaceId/tags`.

CRUD endpoints: POST (create), GET (list by workspace), PATCH :id (update), DELETE :id.

**Step 1:** Create entity, schema, repository, service, controller, dto, module.
**Step 2:** Add TagModule to app.module.ts imports.
**Step 3: Commit**

```bash
git add apps/api/src/modules/tag/ apps/api/src/app.module.ts
git commit -m "feat(api): add Tag module"
```

---

### Task 4.2: Create TodoList module

**Files:**
- Create: `apps/api/src/modules/todo-list/todo-list.entity.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.schema.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.repository.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.service.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.controller.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.dto.ts`
- Create: `apps/api/src/modules/todo-list/todo-list.module.ts`

TodoList entity: name, color, icon, workspaceId, isShared, creatorId. Controller scoped under `/workspaces/:workspaceId/todo-lists`.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/todo-list/ apps/api/src/app.module.ts
git commit -m "feat(api): add TodoList module"
```

---

### Task 4.3: Create Todo module

**Files:**
- Create: `apps/api/src/modules/todo/todo.entity.ts`
- Create: `apps/api/src/modules/todo/todo.schema.ts`
- Create: `apps/api/src/modules/todo/todo.repository.ts`
- Create: `apps/api/src/modules/todo/todo.service.ts`
- Create: `apps/api/src/modules/todo/todo.controller.ts`
- Create: `apps/api/src/modules/todo/todo.dto.ts`
- Create: `apps/api/src/modules/todo/todo.module.ts`

Todo entity: title, description, status ('todo'|'in_progress'|'done'), priority ('none'|'low'|'medium'|'high'|'urgent'), dueDate, listId, workspaceId, assigneeId, creatorId, order, recurring (optional JSON config).

Controller scoped under `/workspaces/:workspaceId/todo-lists/:listId/todos`. Endpoints include CRUD + reorder + status change.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/todo/ apps/api/src/app.module.ts
git commit -m "feat(api): add Todo module"
```

---

### Task 4.4: Create Journal module

**Files:**
- Create: `apps/api/src/modules/journal/journal.entity.ts`
- Create: `apps/api/src/modules/journal/journal.schema.ts`
- Create: `apps/api/src/modules/journal/journal.repository.ts`
- Create: `apps/api/src/modules/journal/journal.service.ts`
- Create: `apps/api/src/modules/journal/journal.controller.ts`
- Create: `apps/api/src/modules/journal/journal.dto.ts`
- Create: `apps/api/src/modules/journal/journal.module.ts`

Journal entity: title, content (rich text JSON from Tiptap), mood (1-5 nullable), tags (string array of tag IDs), workspaceId, authorId, date.

Controller scoped under `/workspaces/:workspaceId/journals`. Support filtering by date range and mood.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/journal/ apps/api/src/app.module.ts
git commit -m "feat(api): add Journal module"
```

---

### Task 4.5: Create Habit module

**Files:**
- Create: `apps/api/src/modules/habit/habit.entity.ts`
- Create: `apps/api/src/modules/habit/habit.schema.ts`
- Create: `apps/api/src/modules/habit/habit.repository.ts`
- Create: `apps/api/src/modules/habit/habit.service.ts`
- Create: `apps/api/src/modules/habit/habit.controller.ts`
- Create: `apps/api/src/modules/habit/habit.dto.ts`
- Create: `apps/api/src/modules/habit/habit.module.ts`

Habit entity: name, description, frequency ('daily'|'weekly'|'custom'), targetCount, unit, color, icon, workspaceId, creatorId. Includes streak calculation logic in service.

Controller scoped under `/workspaces/:workspaceId/habits`.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/habit/ apps/api/src/app.module.ts
git commit -m "feat(api): add Habit module"
```

---

### Task 4.6: Create HabitEntry module

**Files:**
- Create: `apps/api/src/modules/habit-entry/habit-entry.entity.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.schema.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.repository.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.service.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.controller.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.dto.ts`
- Create: `apps/api/src/modules/habit-entry/habit-entry.module.ts`

HabitEntry entity: habitId, date, value (number), notes, workspaceId. Compound index on [habitId+date] for uniqueness per day.

Controller scoped under `/workspaces/:workspaceId/habits/:habitId/entries`.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/habit-entry/ apps/api/src/app.module.ts
git commit -m "feat(api): add HabitEntry module"
```

---

### Task 4.7: Create Activity module

**Files:**
- Create: `apps/api/src/modules/activity/activity.entity.ts`
- Create: `apps/api/src/modules/activity/activity.schema.ts`
- Create: `apps/api/src/modules/activity/activity.repository.ts`
- Create: `apps/api/src/modules/activity/activity.service.ts`
- Create: `apps/api/src/modules/activity/activity.controller.ts`
- Create: `apps/api/src/modules/activity/activity.module.ts`

Activity entity: actorId, action (string like 'created', 'updated', 'deleted'), entityType, entityId, entityTitle, changes (optional JSON diff), workspaceId.

The ActivityService is injected into other services to log changes. Controller provides read-only list endpoint.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/activity/ apps/api/src/app.module.ts
git commit -m "feat(api): add Activity module for audit logging"
```

---

### Task 4.8: Create Notification module

**Files:**
- Create: `apps/api/src/modules/notification/notification.entity.ts`
- Create: `apps/api/src/modules/notification/notification.schema.ts`
- Create: `apps/api/src/modules/notification/notification.repository.ts`
- Create: `apps/api/src/modules/notification/notification.service.ts`
- Create: `apps/api/src/modules/notification/notification.controller.ts`
- Create: `apps/api/src/modules/notification/notification.module.ts`

Notification entity: recipientId, type, title, message, entityType, entityId, actorId, read, readAt, workspaceId. Endpoints: list (with unread filter), unread count, mark all read.

**Step 1:** Create all files.
**Step 2:** Add to app.module.ts.
**Step 3: Commit**

```bash
git add apps/api/src/modules/notification/ apps/api/src/app.module.ts
git commit -m "feat(api): add Notification module"
```

---

## Phase 5: Core Package — API Client & Stores

### Task 5.1: Add domain types to packages/core

**Files:**
- Create: `packages/core/src/types/todo.ts`
- Create: `packages/core/src/types/journal.ts`
- Create: `packages/core/src/types/habit.ts`
- Create: `packages/core/src/types/tag.ts`
- Create: `packages/core/src/types/activity.ts`
- Create: `packages/core/src/types/notification.ts`
- Modify: `packages/core/src/types/index.ts`

Define TypeScript interfaces matching each backend entity's serialized form (what the API returns). These are the shared types used by both frontend and offline package.

**Step 1:** Create each type file and update the barrel export.
**Step 2: Commit**

```bash
git add packages/core/src/types/
git commit -m "feat(core): add domain types for todo, journal, habit, tag, activity, notification"
```

---

### Task 5.2: Create API client

**Files:**
- Create: `packages/core/src/api/client.ts`
- Create: `packages/core/src/api/auth.ts`
- Create: `packages/core/src/api/workspaces.ts`
- Create: `packages/core/src/api/todos.ts`
- Create: `packages/core/src/api/journals.ts`
- Create: `packages/core/src/api/habits.ts`
- Create: `packages/core/src/api/tags.ts`
- Create: `packages/core/src/api/activities.ts`
- Create: `packages/core/src/api/notifications.ts`

Follow atlas pattern: `createApiClient()` factory using Axios with auth interceptors and token refresh. Each domain gets a `createXxxApi(client)` factory returning typed methods.

**Step 1:** Create client.ts with Axios setup (matches atlas `client.ts` exactly — bearer/cookie strategy, 401 refresh interceptor).
**Step 2:** Create each API module.
**Step 3: Commit**

```bash
git add packages/core/src/api/
git commit -m "feat(core): add typed API client for all domain modules"
```

---

### Task 5.3: Create Zustand stores

**Files:**
- Create: `packages/core/src/stores/auth-store.ts`
- Create: `packages/core/src/stores/workspace-store.ts`

Follow atlas pattern: factory functions that accept a StorageAdapter for platform-agnostic persistence.

**Step 1:** Create auth-store.ts (user, isAuthenticated, setUser, clearUser — persisted).
**Step 2:** Create workspace-store.ts (activeWorkspaceId, sidebarOpen, mobileSidebarOpen — persisted).
**Step 3: Commit**

```bash
git add packages/core/src/stores/
git commit -m "feat(core): add Zustand stores for auth and workspace"
```

---

## Phase 6: Frontend PWA Setup

### Task 6.1: Configure PWA app with shadcn and required dependencies

**Files:**
- Modify: `apps/pwa/package.json` (add dependencies)
- Create: `apps/pwa/components.json` (shadcn config)
- Modify: `apps/pwa/app/globals.css` (shadcn theme with CSS variables)
- Create: `apps/pwa/postcss.config.mjs`
- Modify: `apps/pwa/next.config.ts` (standalone output)

**Step 1:** Add dependencies to apps/pwa/package.json:
- @repo/core, @repo/offline, @repo/ui
- @tanstack/react-query, axios, zustand
- @radix-ui/* components (dialog, dropdown, label, popover, select, separator, tabs, tooltip, avatar)
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- tailwind-merge, class-variance-authority, clsx
- lucide-react, date-fns, sonner, cmdk, next-themes
- @serwist/next (PWA service worker)
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder

**Step 2:** Create components.json for shadcn (new-york style, neutral base color, CSS variables).

**Step 3:** Update globals.css with OKLch color variables (light + dark mode) matching atlas pattern.

**Step 4:** Create postcss.config.mjs with @tailwindcss/postcss plugin.

**Step 5:** Update next.config.ts for standalone output + serwist service worker.

**Step 6:** Install and verify

```bash
bun install
```

**Step 7: Commit**

```bash
git add apps/pwa/
git commit -m "feat(pwa): configure shadcn, Tailwind, and PWA dependencies"
```

---

### Task 6.2: Create app layout, providers, and auth pages

**Files:**
- Modify: `apps/pwa/app/layout.tsx` (root layout with providers)
- Create: `apps/pwa/lib/theme-provider.tsx`
- Create: `apps/pwa/lib/query-provider.tsx`
- Create: `apps/pwa/lib/api-client.ts`
- Create: `apps/pwa/stores/auth-store.ts`
- Create: `apps/pwa/stores/workspace-store.ts`
- Create: `apps/pwa/app/(auth)/layout.tsx`
- Create: `apps/pwa/app/(auth)/login/page.tsx`
- Create: `apps/pwa/app/(auth)/register/page.tsx`
- Create: `apps/pwa/app/(dashboard)/layout.tsx`
- Create: `apps/pwa/app/(dashboard)/page.tsx`
- Create: `apps/pwa/app/sw.ts` (service worker)
- Create: `apps/pwa/public/manifest.json`

**Step 1:** Create providers (ThemeProvider wrapping next-themes, QueryProvider wrapping React Query).

**Step 2:** Create api-client.ts instantiating createApiClient from @repo/core with cookie strategy and localhost:4000 base URL.

**Step 3:** Create store instances using createAuthStore and createWorkspaceStore from @repo/core.

**Step 4:** Create root layout with font loading, ThemeProvider, QueryProvider, and Sonner toaster.

**Step 5:** Create auth layout (centered card with Meridian branding).

**Step 6:** Create login page with email/password form + Google OAuth button.

**Step 7:** Create register page with name/email/password form.

**Step 8:** Create dashboard layout with sidebar + header (placeholder content).

**Step 9:** Create dashboard home page (placeholder — will be filled in Phase 7).

**Step 10:** Create service worker and PWA manifest.

**Step 11: Commit**

```bash
git add apps/pwa/
git commit -m "feat(pwa): add app layout, auth pages, and PWA manifest"
```

---

## Phase 7: Frontend Feature Pages

### Task 7.1: Build Todo feature UI

**Files:**
- Create: `apps/pwa/app/(dashboard)/todos/page.tsx`
- Create: `apps/pwa/app/(dashboard)/todos/[listId]/page.tsx`
- Create: `apps/pwa/components/todos/todo-list-sidebar.tsx`
- Create: `apps/pwa/components/todos/todo-item.tsx`
- Create: `apps/pwa/components/todos/create-todo-dialog.tsx`
- Create: `apps/pwa/components/todos/todo-filters.tsx`
- Create: `apps/pwa/lib/api/todos.ts` (hooks wrapping useOfflineQuery/useOfflineMutation)

**Step 1:** Create the todo list page with sidebar showing all lists + list content area.
**Step 2:** Create todo item component with checkbox, priority badge, due date, drag handle.
**Step 3:** Create the create/edit todo dialog.
**Step 4:** Create API hooks using useOfflineQuery for listing and useOfflineMutation for CRUD.
**Step 5:** Wire up drag-and-drop reordering with @dnd-kit.
**Step 6: Commit**

```bash
git add apps/pwa/app/\(dashboard\)/todos/ apps/pwa/components/todos/ apps/pwa/lib/api/todos.ts
git commit -m "feat(pwa): add Todo feature UI with offline support"
```

---

### Task 7.2: Build Journal feature UI

**Files:**
- Create: `apps/pwa/app/(dashboard)/journal/page.tsx`
- Create: `apps/pwa/app/(dashboard)/journal/[id]/page.tsx`
- Create: `apps/pwa/components/journal/journal-list.tsx`
- Create: `apps/pwa/components/journal/journal-editor.tsx`
- Create: `apps/pwa/components/journal/mood-picker.tsx`
- Create: `apps/pwa/components/journal/journal-calendar.tsx`
- Create: `apps/pwa/lib/api/journals.ts`

**Step 1:** Create journal list page with calendar view showing entry dates.
**Step 2:** Create journal editor page with Tiptap rich text editor.
**Step 3:** Create mood picker component (1-5 scale with emoji faces).
**Step 4:** Create API hooks with offline support.
**Step 5: Commit**

```bash
git add apps/pwa/app/\(dashboard\)/journal/ apps/pwa/components/journal/ apps/pwa/lib/api/journals.ts
git commit -m "feat(pwa): add Journal feature UI with Tiptap editor"
```

---

### Task 7.3: Build Habit feature UI

**Files:**
- Create: `apps/pwa/app/(dashboard)/habits/page.tsx`
- Create: `apps/pwa/components/habits/habit-card.tsx`
- Create: `apps/pwa/components/habits/habit-streak.tsx`
- Create: `apps/pwa/components/habits/create-habit-dialog.tsx`
- Create: `apps/pwa/components/habits/habit-calendar.tsx`
- Create: `apps/pwa/lib/api/habits.ts`

**Step 1:** Create habits page with grid of habit cards showing current streaks.
**Step 2:** Create habit card with check-in button and streak counter.
**Step 3:** Create streak visualization (calendar heatmap or progress bar).
**Step 4:** Create create/edit habit dialog.
**Step 5:** Create API hooks with offline support.
**Step 6: Commit**

```bash
git add apps/pwa/app/\(dashboard\)/habits/ apps/pwa/components/habits/ apps/pwa/lib/api/habits.ts
git commit -m "feat(pwa): add Habit tracking feature UI"
```

---

### Task 7.4: Build Dashboard home page

**Files:**
- Modify: `apps/pwa/app/(dashboard)/page.tsx`
- Create: `apps/pwa/components/dashboard/today-todos.tsx`
- Create: `apps/pwa/components/dashboard/habit-summary.tsx`
- Create: `apps/pwa/components/dashboard/recent-journals.tsx`

**Step 1:** Build dashboard showing today's todos (due today or overdue), habit check-in summary, and recent journal entries.
**Step 2:** Each widget fetches from offline-first hooks.
**Step 3: Commit**

```bash
git add apps/pwa/app/\(dashboard\)/page.tsx apps/pwa/components/dashboard/
git commit -m "feat(pwa): add dashboard home with today's overview"
```

---

### Task 7.5: Build Settings pages

**Files:**
- Create: `apps/pwa/app/(dashboard)/settings/page.tsx`
- Create: `apps/pwa/components/settings/profile-form.tsx`
- Create: `apps/pwa/components/settings/workspace-settings.tsx`
- Create: `apps/pwa/components/settings/members-list.tsx`

**Step 1:** Create settings page with tabs for Profile, Workspace, and Members.
**Step 2:** Profile form: name, avatar, timezone.
**Step 3:** Workspace settings: name, description.
**Step 4:** Members list: invite, change roles, remove.
**Step 5: Commit**

```bash
git add apps/pwa/app/\(dashboard\)/settings/ apps/pwa/components/settings/
git commit -m "feat(pwa): add settings pages for profile, workspace, and members"
```

---

## Phase 8: Offline Sync Integration

### Task 8.1: Wire up offline sync in PWA

**Files:**
- Create: `apps/pwa/lib/offline.ts`
- Modify: `apps/pwa/app/(dashboard)/layout.tsx` (add useAutoSync)
- Create: `apps/pwa/components/shared/offline-indicator.tsx`

**Step 1:** Create offline.ts that configures fullSync with all entity tables and API fetchers (matching atlas pattern).
**Step 2:** Add useAutoSync to dashboard layout (sync every 60 seconds).
**Step 3:** Create offline indicator component showing pending mutation count and sync status.
**Step 4: Commit**

```bash
git add apps/pwa/lib/offline.ts apps/pwa/app/\(dashboard\)/layout.tsx apps/pwa/components/shared/
git commit -m "feat(pwa): wire up offline sync and add offline indicator"
```

---

## Phase 9: Testing

### Task 9.1: Set up Vitest for API

**Files:**
- Create: `apps/api/vitest.config.ts`
- Modify: `apps/api/package.json` (add vitest to devDependencies and test script)

**Step 1:** Configure vitest for the NestJS API with TypeScript support.
**Step 2: Commit**

```bash
git add apps/api/vitest.config.ts apps/api/package.json
git commit -m "chore(api): configure Vitest for testing"
```

---

### Task 9.2: Write entity unit tests

**Files:**
- Create: `apps/api/src/modules/user/user.entity.spec.ts`
- Create: `apps/api/src/modules/workspace/workspace.entity.spec.ts`
- Create: `apps/api/src/modules/todo/todo.entity.spec.ts`
- Create: `apps/api/src/modules/journal/journal.entity.spec.ts`
- Create: `apps/api/src/modules/habit/habit.entity.spec.ts`

Test each entity's `create()` (valid + invalid), `reconstitute()`, `toObject()`, business methods, and `softDelete()`/`restore()`.

**Step 1:** Write test for each entity.
**Step 2:** Run tests

```bash
cd apps/api && bun run test
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/**/*.spec.ts
git commit -m "test(api): add unit tests for domain entities"
```

---

### Task 9.3: Write shared infrastructure tests

**Files:**
- Create: `apps/api/src/shared/result.spec.ts`
- Create: `apps/api/src/shared/pagination.spec.ts`

Test Result type (Ok, Err), pagination meta calculation.

**Step 1:** Write and run tests.
**Step 2: Commit**

```bash
git add apps/api/src/shared/*.spec.ts
git commit -m "test(api): add unit tests for shared Result and pagination"
```

---

## Phase 10: Final Wiring & Verification

### Task 10.1: Verify full backend startup

**Step 1:** Ensure MongoDB is running locally.
**Step 2:** Create .env from .env.example with real values.
**Step 3:** Start the API:

```bash
cd apps/api && bun run dev
```

Expected: API starts on port 4000, health check at http://localhost:4000/health returns `{ "status": "ok" }`.

**Step 4:** Test auth endpoints with curl:

```bash
# Register
curl -X POST http://localhost:4000/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","name":"Test","password":"test1234"}'

# Login
curl -X POST http://localhost:4000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"test1234"}'
```

**Step 5:** Verify the response contains user data and cookies are set.

---

### Task 10.2: Verify full frontend startup

**Step 1:** Start the PWA:

```bash
cd apps/pwa && bun run dev
```

Expected: Next.js starts on port 3000.

**Step 2:** Open http://localhost:3000 in browser. Should show login page.
**Step 3:** Register a new user, create a workspace, verify navigation to dashboard.

---

### Task 10.3: Verify turbo dev runs both apps

```bash
bun run dev
```

Expected: Both API (port 4000) and PWA (port 3000) start via turborepo.

---

## Execution Notes

- **Reference project**: `~/stageholder-atlas` contains working implementations of every pattern. When in doubt, check the atlas code.
- **Package naming**: Atlas uses `@stageholder-atlas/*`, Meridian uses `@repo/*` (Turborepo default).
- **Port**: Atlas API runs on 3001, Meridian API runs on 4000 to avoid conflicts.
- **Database**: Atlas uses `stageholder-atlas` DB, Meridian uses `meridian` DB.
- **Commit frequently**: Each task should end with a commit.
- **TDD where practical**: Entity tests should be written before or alongside implementation.
