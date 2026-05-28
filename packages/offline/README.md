# @repo/offline

Offline-first storage + sync engine for Meridian. Powers the PWA's read-from-
cache, write-through, background-resync UX so the app stays usable on flaky
networks and feels instant on the happy path.

## Layout

```
src/
  db/
    index.ts        Dexie (IndexedDB) implementation — the web `db` singleton
    interface.ts    DataStore — the cross-platform storage contract
  sync/
    sync-manager.ts Delta-sync engine (pull server changes since last cursor)
    mutation-queue.ts Outbox for offline writes; replays on reconnect
    id-reconciler.ts  Reconciles optimistic tempIds with server-assigned ids
  network/
    index.ts        useNetworkStatus() — online/offline reactive signal
  hooks/
    index.ts        useOfflineQuery / useOfflineMutation — React Query
                    wrappers that read from Dexie first, then revalidate
    use-offline-calendar.ts  Calendar-day data assembled from local tables
```

## Cross-platform strategy (web + native)

The current `db` singleton is a `Dexie` subclass — IndexedDB, web-only.
For the future React Native mobile app, the strategy is to **ship a parallel
SQLite-backed implementation** that satisfies the same shape, NOT to share
IndexedDB across platforms.

Concretely:

- **`db/interface.ts`** declares `DataStore` — the operations the sync
  engine and mutation queue need to be portable. The Dexie `db` satisfies
  this interface structurally.
- **`db/index.ts`** is the web implementation (Dexie).
- **`db/index.native.ts`** (future, mobile) will provide the same
  `export const db: DataStore` backed by `expo-sqlite` / `op-sqlite` /
  WatermelonDB — picked at bundle time by Metro's platform-suffix resolver.

### Migration sequence when the mobile app begins

1. Refactor `sync-manager.fullSync()` and `mutation-queue.flush()` to take
   their `db` via a parameter (DI) rather than importing the singleton.
   This isolates the engine from the storage layer.
2. The PWA call site (`apps/pwa/src/lib/offline.ts`) starts passing
   `{ db }` — no behavior change.
3. The mobile app implements `DataStore` over SQLite and passes its own
   `db`. The sync engine works unchanged.
4. App-level queries (`lib/api/*`, `lib/crypto/*`, `lib/entitlement.ts`)
   stay per-app — the mobile app writes its own wiring against its own
   `db`. The web app keeps using Dexie's API directly where it benefits
   from Dexie-specific features (compound indexes, `liveQuery`, etc.).

### Why this split

The shared `DataStore` interface is intentionally narrow — only what the
sync engine needs. The PWA's app-level data access keeps the full Dexie
surface (chainable `.where().equals()`, `Collection.modify`, `liveQuery`),
because re-implementing every Dexie quirk on SQLite for parity isn't worth
the complexity. The mobile app gets the freedom to use SQLite-native query
patterns for its app code.

What we DO share between web and mobile:

- The sync engine (`sync/`)
- The mutation queue (`sync/mutation-queue.ts`)
- The entity schemas (re-exported from `@repo/core/types`)
- The conflict-resolution rules (in `sync-manager.ts`)
- The `DataStore` contract

What we DON'T share:

- The storage backend (IndexedDB vs SQLite)
- The app's direct data-access wiring (`apps/*/lib/api/*`)
- Anything that depends on `window` / `document` / `localStorage`

## Status

- [x] Schema declared (`db/index.ts` Dexie subclass, v5)
- [x] `DataStore` cross-platform contract (`db/interface.ts`)
- [ ] `fullSync()` / `flush()` take `db` via DI (sequenced for when mobile
      starts — refactor is small but cascades to call sites)
- [ ] `db/index.native.ts` SQLite implementation
- [ ] Mobile app `apps/mobile/src/lib/api/*` wiring
