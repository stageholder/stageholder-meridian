'use client';

import { useState } from 'react';
import { useLightEvents } from '@/lib/api/light';
import { format, parseISO } from 'date-fns';

const ACTION_LABELS: Record<string, string> = {
  todo_complete: 'Completed todo',
  habit_checkin: 'Habit check-in',
  journal_entry: 'Journal entry',
  perfect_day: 'Perfect Day bonus',
  ring_streak_bonus: 'Streak milestone',
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

  // Group events by date
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
            {/* Day header */}
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-sm font-medium text-foreground">
                {format(parseISO(dateKey), 'MMM d, yyyy')}
              </span>
              <span className="text-sm font-semibold text-amber-500 tabular-nums">
                +{dayTotal} Light
              </span>
            </div>

            {/* Events */}
            <div className="mt-2 space-y-1.5">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {ACTION_LABELS[event.action] ?? event.action}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {event.baseLight} x {event.multiplier} ={' '}
                    <span className="font-medium text-foreground">
                      {event.totalLight}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setLimit((l) => l + LOAD_MORE)}
          className="w-full rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Show more
        </button>
      )}
    </div>
  );
}
