# Meridian Light System - Design Document

## Overview

A gamification and motivation system for Meridian inspired by Todoist's karma but uniquely personal. Users earn "Light" through productive actions, building streaks and leveling through 10 celestial tiers — from Stargazer to Meridian.

The system rewards both action (completing todos, checking in habits, journaling) and consistency (streak multipliers, Perfect Day bonuses). Light is never lost. Stars never dim. Only momentum changes.

## Core Concept

The user begins as a **Stargazer** — someone looking up at the stars. Through consistent daily engagement, they *become* the star, growing brighter through 10 tiers until reaching **Meridian** — the astronomical term for a star at its absolute highest point in the sky.

## Tier Progression

| Tier | Title | Light Needed | Typical Timeline | Psychological Alignment |
|------|-------|-------------|-----------------|------------------------|
| 1 | Stargazer | 0 | Day 0 | Starting intention |
| 2 | Spark | 50 | Day 1-2 | Immediate reward (endowed progress effect) |
| 3 | Ember | 150 | Day 4-5 | First week momentum |
| 4 | Flame | 400 | Day 10-14 | Two-week hook |
| 5 | Radiant | 800 | Day 18-24 | ~21 day habit threshold |
| 6 | Flare | 1,500 | Day 30-40 | One month identity shift |
| 7 | Nova | 2,800 | Day 55-70 | ~66 day automaticity (Lally UCL research) |
| 8 | Pulsar | 5,000 | Day 85-100 | ~90 day deep neural formation |
| 9 | Supernova | 8,500 | Day 140-170 | ~5-6 months, mastery |
| 10 | Meridian | 13,000 | Day 250-300 | ~9 months, transformation |

Pacing follows a logarithmic curve (each level ~1.5-2x the previous) aligned with Csikszentmihalyi's flow theory and habit formation research (21/66/90 day thresholds).

## Points Engine

### Base Light Earnings

| Action | Base Light | Trigger |
|--------|-----------|---------|
| Complete a todo (none/low priority) | 3 | Todo status -> done |
| Complete a todo (medium priority) | 4 | Todo status -> done |
| Complete a todo (high/urgent priority) | 5 | Todo status -> done |
| Habit check-in | 4 | HabitEntry created |
| Journal entry | 6 | Journal created |
| Perfect Day bonus | 10 | All 3 rings filled for the day |

### Ring Completion Rules

- **Todo ring:** at least 1 todo completed
- **Habit ring:** all scheduled habits for that day checked in
- **Journal ring:** at least 1 journal entry written
- **Empty rings count as complete:** if a user has no habits configured, habit ring = fulfilled (0/0). Same for todos.

### Perfect Day Streak Multiplier

Applied to all Light earned that day:

| Consecutive Perfect Days | Multiplier |
|--------------------------|-----------|
| 1-2 | 1x |
| 3-6 | 1.5x |
| 7-13 | 2x |
| 14-29 | 2.5x |
| 30+ | 3x |

### Per-Ring Streak Milestones

Flat bonuses awarded once when milestone is hit:

| Ring Streak Length | Bonus Light |
|-------------------|-------------|
| 7 days | +5 |
| 30 days | +15 |
| 60 days | +30 |
| 100 days | +50 |

### Key Rules

1. Light is never subtracted. Breaking a streak resets the multiplier, not accumulated Light.
2. No double-counting. Each action logged once per entity per day.
3. No retroactive calculation. Points awarded when actions happen.
4. Streak evaluation is lazy — calculated on first action of the new day.
5. Tier recalculated after every LightEvent — level-ups are instant.

## Data Model

### UserLight (one per user, user-scoped not workspace-scoped)

| Field | Type | Purpose |
|-------|------|---------|
| userId | string | Owner (unique, one per user) |
| totalLight | number | Lifetime Light, never decreases |
| currentTier | number (1-10) | Cached current level |
| currentTitle | string | Cached title |
| perfectDayStreak | number | Consecutive Perfect Days |
| todoRingStreak | number | Per-ring streak |
| habitRingStreak | number | Per-ring streak |
| journalRingStreak | number | Per-ring streak |
| lastActiveDate | string (YYYY-MM-DD) | Last active day |
| longestPerfectStreak | number | All-time record |
| perfectDaysTotal | number | Lifetime Perfect Days |

### LightEvent (audit log, keeps workspaceId for attribution)

| Field | Type | Purpose |
|-------|------|---------|
| userId | string | Who earned it |
| workspaceId | string | Where the action happened |
| action | enum | todo_complete, habit_checkin, journal_entry, perfect_day, ring_streak_bonus |
| baseLight | number | Points before multiplier |
| multiplier | number | Streak multiplier applied |
| totalLight | number | Final points earned |
| date | string (YYYY-MM-DD) | When earned |
| metadata | object | Optional: todoId, habitId, journalId, streakLength |

### Why user-scoped, not workspace-scoped

The star represents personal identity and growth. Splitting progress across workspaces would dilute achievement, break the identity loop ("I am a Nova"), and violate the holistic growth philosophy. LightEvent keeps workspaceId so the detail page can show where points came from.

## Backend Architecture

### Module Structure

```
apps/api/src/modules/light/
  domain/
    user-light.entity.ts
    light-event.entity.ts
    light-config.ts          # Tier thresholds, point values, multiplier rules
  repository/
    user-light.repository.ts
    light-event.repository.ts
  light.service.ts           # Core engine: award points, calculate streaks, level-ups
  light.controller.ts        # GET /light/me, GET /light/events
  light.module.ts
```

### Integration

Event-driven — existing services call LightService at the end of their mutations:

- TodoService -> LightService.awardTodoComplete(userId, priority)
- HabitEntryService -> LightService.awardHabitCheckin(userId)
- JournalService -> LightService.awardJournalEntry(userId)

### Streak Evaluation: Lazy

On first action of a new day, LightService checks the previous day's ring completion and updates streaks/multiplier. No cron needed.

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /light/me | Returns UserLight (tier, streaks, stats) |
| GET | /light/events?limit=20&offset=0 | Paginated Light event history |

## UI Design

### Dashboard: Star in Activity Rings Center

The star visual lives inside the existing activity rings as the centerpiece. Star appearance changes per tier (tiny dot -> glowing orb -> pulsing star -> full celestial body). Below the star: title text (e.g., "Nova").

### Dashboard: Level Progress Bar

Below the activity rings:

```
Nova ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○ Pulsar
2,800 / 5,000 Light              x2 streak 7d
```

Left: current title. Right: next title. Bar fills showing progress within tier. Below: Light count, multiplier, Perfect Day streak.

### Level-Up Celebration

Full-screen overlay (1-2 seconds, dismissible) with:
- New star visual animating in with burst effect
- Title announcement: "You've become a Nova"
- Description of the visual change
- Confetti/particle effect in ring colors

### Compact Badge (Sidebar)

Tiny star icon next to user avatar. Hover tooltip: "Nova - 2,800 Light".

### "My Journey" Detail Page

Accessible by tapping star/level bar or from nav. Sections:

1. **Hero:** Large star visual + title + progress bar
2. **Streaks:** Grid showing Perfect Day, Todo, Habit, Journal streaks with all-time bests
3. **Tier Map:** Horizontal path of all 10 tiers with completed/current/future states
4. **Stats:** Total Light, Perfect Days, Longest Streak, Current Multiplier
5. **Recent Light:** Scrollable feed grouped by day, showing individual actions with base x multiplier

## Offline Support

- Points calculated server-side only
- Dashboard shows stale Light data when offline (last fetched)
- No local Light calculation to avoid desync

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Uncomplete a todo | No Light deducted |
| Delete a journal | No Light deducted |
| Complete same todo twice in one day | Only first awards Light |
| Inactive for multiple days | Streaks reset to 0, multiplier drops to 1x, total Light unchanged |
| No habits configured | Habit ring = complete (0/0 fulfilled) |
| No todos for today | Todo ring = complete |
| Timezone | Dates use user's timezone field |
| New user | Starts as Stargazer, 0 Light |

## Not Building (YAGNI)

- No leaderboards or social comparison
- No badges/achievements (tiers are enough)
- No Light decay over time
- No custom point values or user settings
- No workspace-specific Light views
- No weekly/monthly Light graphs
