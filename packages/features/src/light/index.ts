// Barrel for the `light` domain — gamification + journey visuals. Consumers
// import via either the barrel (`@repo/features/light`) or per-file
// (`@repo/features/light/star-visual`); both are exposed via the package's
// `exports` field.

export { StarVisual } from "./star-visual";
export { LevelProgress } from "./level-progress";
export { LevelUpCelebration } from "./level-up-celebration";
export { JourneyStats } from "./journey-stats";
export { JourneyStreaks } from "./journey-streaks";
export { JourneyTierMap } from "./journey-tier-map";
export { JourneyFeed, type JourneyFeedProps } from "./journey-feed";
