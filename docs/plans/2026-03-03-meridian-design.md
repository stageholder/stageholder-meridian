# Meridian — Personal Productivity App Design

## Overview

Meridian is a multi-platform personal productivity application featuring todo lists, journaling, and habit tracking. It targets multiple users from day one with a full workspace model, offline-first architecture, and cross-platform support (Web PWA, Desktop, Mobile via Tauri).

## Motivations

- Privacy and data ownership
- Custom workflow tailored to personal productivity
- Learning opportunity with modern tech stack

## Tech Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| Monorepo     | Turborepo + Bun                            |
| Backend      | NestJS + MongoDB (Mongoose)                |
| Frontend     | Next.js + shadcn/ui (Radix + Tailwind)     |
| Local DB     | Dexie (IndexedDB)                          |
| Desktop      | Tauri                                      |
| Mobile       | Tauri Mobile                               |
| State        | Zustand (persisted, platform-aware)        |
| Rich Text    | Tiptap                                     |
| Validation   | Zod                                        |
| Testing      | Vitest + Playwright                        |
| Architecture | DDD (mirroring stageholder-atlas patterns) |

## Monorepo Structure

```
stageholder-meridian/
├── apps/
│   ├── api/              # NestJS backend (port 4000)
│   ├── pwa/              # Next.js PWA (port 3000)
│   ├── desktop/          # Tauri + React desktop app
│   └── docs/             # Documentation site (port 3001)
├── packages/
│   ├── core/             # Shared types, API client, Zustand stores
│   ├── offline/          # Dexie DB, sync manager, mutation queue
│   ├── ui/               # shadcn components
│   ├── eslint-config/    # Shared ESLint rules
│   └── typescript-config/ # Shared TypeScript config
```

### Package Responsibilities

- **apps/pwa**: Single frontend codebase for web, desktop (Tauri wraps it), and mobile (Tauri mobile wraps it)
- **packages/core**: Shared TypeScript types, Axios-based API client, Zustand stores, platform abstraction layer
- **packages/offline**: Dexie database schema, sync manager, mutation queue — dedicated offline-first infrastructure
- **packages/ui**: shadcn components built on Radix UI + Tailwind CSS

## Domain Models

### Auth & Identity

**User**

- email, name, avatar, timezone, provider (local/google)
- Auth: JWT access/refresh tokens, OAuth2 (Google)

**Workspace**

- name, slug, owner, settings
- Root aggregate for multi-tenancy

**WorkspaceMember**

- userId, workspaceId, role (owner/admin/member)

### Todo Module

**TodoList**

- name, color, icon, workspaceId, isShared

**Todo**

- title, description, dueDate, priority (none/low/medium/high/urgent)
- status (todo/in_progress/done), listId, assigneeId, order
- Recurring configuration

**TodoComment**

- content, todoId, authorId

### Journal Module

**Journal**

- title, content (rich text via Tiptap), mood (1-5 scale), tags[], workspaceId, date

**JournalTemplate**

- name, content template, prompts[]

### Habit Module

**Habit**

- name, description, frequency (daily/weekly/custom), targetCount, unit, color, icon, workspaceId

**HabitEntry**

- habitId, date, value (number), notes

### Shared

**Tag** — name, color, workspaceId (usable across modules)
**Activity** — audit log for all entity changes
**Notification** — user notifications (in-app + push)

### Entity Patterns (from atlas)

All entities follow:

- `Entity<T>` base class with id, createdAt, updatedAt, deletedAt (soft delete)
- `Result<T, E>` type for creation (railway-oriented error handling)
- Static `create()` factory method with validation
- Static `reconstitute()` for hydration from persistence
- `toObject()` for serialization

## Backend API Structure

### NestJS Module Map

```
AppModule (root)
├── AuthModule         → JWT + Google OAuth
├── UserModule         → Profile management
├── WorkspaceModule    → CRUD, settings
├── WorkspaceMemberModule → Invite, roles
├── TodoListModule     → Lists within workspace
├── TodoModule         → CRUD, assignment, ordering, recurring
├── JournalModule      → CRUD, templates, mood tracking
├── HabitModule        → CRUD, entries, streaks calculation
├── TagModule          → Shared tags across modules
├── ActivityModule     → Audit trail
├── NotificationModule → Push/in-app notifications
└── SyncModule         → Sync endpoints (pull/push)
```

### API Conventions

- Global prefix: `/api/v1`
- DTOs validated with Zod (via NestJS pipe)
- Pagination: `{ data, meta: { total, page, limit, totalPages, hasNext, hasPrev } }`
- Soft deletes via `deletedAt` field
- UUID primary keys (string-based)
- Repository pattern for data access
- Upsert pattern: `updateOne({ _id }, { $set }, { upsert: true })`

### Module Structure Pattern

Each domain module contains:

- `*.entity.ts` — Domain entity with business logic
- `*.repository.ts` — Data access abstraction
- `*.service.ts` — Business operations orchestration
- `*.controller.ts` — HTTP endpoints
- `*.dto.ts` — Zod-validated DTOs
- `*.schema.ts` — Mongoose schema
- `*.module.ts` — NestJS module definition

## Offline-First & Sync Architecture

### Dexie Database Schema

```typescript
class MeridianDB extends Dexie {
  workspaces!: EntityTable<Workspace, "id">;
  workspaceMembers!: EntityTable<WorkspaceMember, "id">;
  todoLists!: EntityTable<TodoList, "id">;
  todos!: EntityTable<Todo, "id">;
  todoComments!: EntityTable<TodoComment, "id">;
  journals!: EntityTable<Journal, "id">;
  journalTemplates!: EntityTable<JournalTemplate, "id">;
  habits!: EntityTable<Habit, "id">;
  habitEntries!: EntityTable<HabitEntry, "id">;
  tags!: EntityTable<Tag, "id">;
  notifications!: EntityTable<AppNotification, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;
  syncMeta!: Table<SyncMeta, [string, string]>;
}
```

### Sync Flow

1. **Write locally first** — all CRUD operations go to Dexie immediately
2. **Queue mutations** — each local write creates a `PendingMutation` entry
3. **Flush when online** — mutation queue sends pending changes to NestJS API
4. **Pull updates** — after flushing, fetch server changes since last sync
5. **Conflict resolution** — last-write-wins based on `updatedAt` timestamps

### Sync Endpoints

- `POST /api/v1/sync/push` — receive batched mutations from client
- `GET /api/v1/sync/pull?since=<timestamp>&types=<entity_types>` — return changes since last sync

### Mutation Queue

- Queues pending mutations (create/update/delete) when offline
- Retry logic with exponential backoff
- Tracks mutation status: pending → in-flight → failed
- Flushes queue on reconnection

## Frontend Architecture

### State Management

- Zustand stores (persisted, platform-aware via storage adapter)
- Auth store: user, isAuthenticated, token management
- Platform abstraction: localStorage for web, secure storage for native

### API Client

- Axios-based, typed API client in packages/core
- Auth interceptor for JWT token attachment
- Automatic token refresh on 401

### Key UI Pages

- **Dashboard** — today's todos, habit streaks, recent journal entries
- **Todos** — list view with drag-and-drop, filters, quick-add
- **Journal** — calendar view + Tiptap rich text editor
- **Habits** — grid/calendar view showing streaks, check-in interface
- **Settings** — workspace, profile, members management

### Platform Strategy

- `apps/pwa` is the single frontend codebase
- Desktop: Tauri wraps the PWA
- Mobile: Tauri mobile wraps the same PWA
- Platform-specific code in `packages/core/src/platform/`

### PWA Features

- Service worker for offline caching
- App manifest for installability
- Push notifications via service worker

## Authentication

- **Local**: Email + password (bcryptjs hashing)
- **OAuth2**: Google authentication
- **JWT**: Short-lived access tokens + long-lived refresh tokens
- Refresh token hash (SHA256) stored in MongoDB with expiry
- Token rotation on refresh

## Testing Strategy

- **Unit tests**: Domain entities and services (Vitest)
- **Integration tests**: API endpoints with test database
- **E2E tests**: Playwright for critical user flows
- **Validation**: Zod schema tests for DTOs

### MVP Test Priorities

1. Entity creation and business logic
2. Auth flow (register, login, refresh)
3. Sync push/pull endpoints
4. Critical UI flows (dashboard, CRUD)

## Reference

This architecture mirrors stageholder-atlas patterns. See that project for implementation examples of:

- Entity base class and Result type
- Repository pattern with Mongoose
- Sync manager and mutation queue
- Zustand stores with platform abstraction
- Tauri desktop integration
