'use client';

import { useState } from 'react';
import { useLightEvents } from '@/lib/api/light';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Plus, Target, BookOpen, Star, Flame, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  todo_complete: { label: 'Completed todo', icon: CheckCircle2, color: 'text-blue-500' },
  todo_create: { label: 'Todo created', icon: Plus, color: 'text-blue-400' },
  habit_checkin: { label: 'Habit check-in', icon: Target, color: 'text-orange-500' },
  journal_entry: { label: 'Journal entry', icon: BookOpen, color: 'text-emerald-500' },
  perfect_day: { label: 'Perfect Day', icon: Star, color: 'text-amber-500' },
  ring_streak_bonus: { label: 'Streak milestone', icon: Flame, color: 'text-red-500' },
  ring_completion_bonus: { label: 'Ring completed', icon: CircleDot, color: 'text-purple-500' },
};

const INITIAL_LIMIT = 10;
const LOAD_MORE = 20;

export function JourneyFeed() {
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const { data: events, isLoading } = useLightEvents(limit, 0);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading events...</p>;
  }

  if (!events || events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Light events yet. Complete tasks, check in habits, or write journal
        entries to earn Light.
      </p>
    );
  }

  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const dateKey = format(parseISO(event.createdAt), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const hasMore = events.length >= limit;

  return (
    <div className="space-y-4">
      {sortedDates.map((dateKey) => {
        const dayEvents = grouped[dateKey]!;
        const dayTotal = dayEvents.reduce((sum, e) => sum + e.totalLight, 0);

        return (
          <div key={dateKey}>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-sm font-medium text-foreground">
                {format(parseISO(dateKey), 'MMM d, yyyy')}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 tabular-nums dark:bg-amber-900/30 dark:text-amber-400">
                +{dayTotal} Light
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              {dayEvents.map((event) => {
                const config = ACTION_CONFIG[event.action] ?? {
                  label: event.action,
                  icon: Star,
                  color: 'text-muted-foreground',
                };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm"
                  >
                    <Icon className={cn('size-3.5 shrink-0', config.color)} />
                    <span className="flex-1 text-foreground">
                      {config.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {event.baseLight} x {event.multiplier} ={' '}
                      <span className="font-medium text-foreground">
                        {event.totalLight}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setLimit((l) => l + LOAD_MORE)}
          className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Show more
        </button>
      )}
    </div>
  );
}
