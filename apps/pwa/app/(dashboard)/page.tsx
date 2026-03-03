export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Meridian</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal productivity dashboard. Manage todos, journal entries, and habits all in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Todos</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">--</p>
          <p className="mt-1 text-xs text-muted-foreground">tasks pending</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Journal</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">--</p>
          <p className="mt-1 text-xs text-muted-foreground">entries this week</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Habits</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">--</p>
          <p className="mt-1 text-xs text-muted-foreground">streak days</p>
        </div>
      </div>
    </div>
  );
}
