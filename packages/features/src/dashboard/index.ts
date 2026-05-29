// Barrel for the `dashboard` domain — bento card chrome + the dashboard's
// summary cards. Each view takes its data + navigation callbacks; the host
// (PWA today, mobile later) hooks the data layer and supplies the
// callbacks wired to its router.

export { BentoCard, type BentoCardProps } from "./bento-card";
export { TodayTodos, type TodayTodosProps } from "./today-todos";
export {
  HabitSummary,
  type HabitSummaryProps,
  type HabitProgressValue,
} from "./habit-summary";
export { RecentJournals, type RecentJournalsProps } from "./recent-journals";
