// Barrel for the `dashboard` domain — the dashboard's CONTENT-ONLY summary
// cells + the KPI stat row. Card chrome + grid position are owned by the host's
// kit `Dashboard`/`Dashboard.Widget`; each view here renders only its body and
// takes its data + navigation callbacks. The host (PWA route / mobile Today)
// hooks the data layer and supplies callbacks wired to its router.

export {
  DashboardStats,
  type DashboardStatsProps,
  type DashboardStatItem,
} from "./dashboard-stats";
export { TodayTodos, type TodayTodosProps } from "./today-todos";
export {
  HabitSummary,
  type HabitSummaryProps,
  type HabitProgressValue,
} from "./habit-summary";
export { RecentJournals, type RecentJournalsProps } from "./recent-journals";
