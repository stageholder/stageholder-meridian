// Barrel for the `charts` domain — props-driven chart views built on the
// kit's cross-platform `BarChart`/`AreaChart`. Each app's hooks compute the
// per-chart `<X>Day` shape and feed it to the view; the view handles
// loading (kit `Skeleton`), empty state, and rendering.

export {
  WeeklyActivityChart,
  type WeeklyActivityChartProps,
  type WeeklyActivityDay,
} from "./weekly-activity-chart";

export {
  JournalGrowthChart,
  type JournalGrowthChartProps,
  type JournalGrowthDay,
} from "./journal-growth-chart";

export {
  MoodTrendChart,
  type MoodTrendChartProps,
  type MoodTrendDay,
} from "./mood-trend-chart";

export {
  LightEarnedChart,
  type LightEarnedChartProps,
  type LightTrendDay,
} from "./light-earned-chart";

export {
  JourneyLightChart,
  type JourneyLightChartProps,
} from "./journey-light-chart";
