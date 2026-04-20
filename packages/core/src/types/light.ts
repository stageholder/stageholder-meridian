export interface UserLight {
  id: string;
  userSub: string;
  totalLight: number;
  currentTier: number;
  currentTitle: string;
  perfectDayStreak: number;
  todoRingStreak: number;
  habitRingStreak: number;
  journalRingStreak: number;
  lastActiveDate: string | null;
  longestPerfectStreak: number;
  perfectDaysTotal: number;
  todoTargetDaily: number;
  journalTargetDailyWords: number;
  createdAt: string;
  updatedAt: string;
}

export interface LightEvent {
  id: string;
  userSub: string;
  action:
    | "todo_complete"
    | "todo_create"
    | "habit_checkin"
    | "journal_entry"
    | "perfect_day"
    | "ring_streak_bonus"
    | "ring_completion_bonus";
  baseLight: number;
  multiplier: number;
  totalLight: number;
  date: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LightStatDay {
  date: string;
  light: number;
}

export interface LightStats {
  baseline: {
    totalLight: number;
  };
  days: LightStatDay[];
}

export interface LightTier {
  tier: number;
  title: string;
  lightRequired: number;
  shortDescription: string;
  description: string;
}

export const LIGHT_TIERS: LightTier[] = [
  {
    tier: 1,
    title: "Stargazer",
    lightRequired: 0,
    shortDescription:
      "You're looking up and dreaming big \u2014 every great journey starts with a single step.",
    description:
      "You've taken the first and most important step: showing up. Like a stargazer mapping the night sky, you're beginning to chart your own path. Most people only dream of changing their lives \u2014 you're actually doing it. Keep going, each small action is a point of light guiding your way forward.",
  },
  {
    tier: 2,
    title: "Spark",
    lightRequired: 50,
    shortDescription:
      "Something's igniting inside you \u2014 your consistency is turning intention into action.",
    description:
      "That initial curiosity has caught fire. You're no longer just thinking about productivity \u2014 you're living it. A spark is fragile, but yours is growing stronger with every completed task, every journal entry, every habit checked off. You're proving to yourself that you can follow through. That's rare and powerful.",
  },
  {
    tier: 3,
    title: "Ember",
    lightRequired: 150,
    shortDescription:
      "You're building real momentum \u2014 your dedication is starting to glow.",
    description:
      "Embers don't burn out easily. You've moved past the excitement of starting and into the quiet strength of continuing. Your habits are taking root, your routines are shaping your days, and the results are starting to show. You're the kind of person who keeps the fire alive when others let it fade.",
  },
  {
    tier: 4,
    title: "Flame",
    lightRequired: 400,
    shortDescription:
      "You're on fire \u2014 discipline has become your superpower.",
    description:
      "You've built something real. Your daily rhythm is no longer forced \u2014 it's natural. Like a steady flame, your consistency lights up everything around you. Tasks get done, habits stick, and your journal captures a life being lived with intention. People around you are starting to notice the change.",
  },
  {
    tier: 5,
    title: "Radiant",
    lightRequired: 800,
    shortDescription:
      "Your energy is contagious \u2014 you're shining brighter than ever.",
    description:
      "You radiate purpose. At this level, productivity isn't something you do \u2014 it's who you are. Your streaks speak for themselves, your perfect days stack up, and your goals feel within reach because you've proven you can show up, day after day. You're not just managing your life \u2014 you're mastering it.",
  },
  {
    tier: 6,
    title: "Flare",
    lightRequired: 1500,
    shortDescription:
      "You're making an impact that can't be ignored \u2014 pure brilliance.",
    description:
      "A flare is impossible to miss, and so is your transformation. You've reached a level most people never see because it demands real, sustained effort. Your habits are deeply embedded, your journal is rich with reflection, and your task completion rate is extraordinary. You're an inspiration in motion.",
  },
  {
    tier: 7,
    title: "Nova",
    lightRequired: 2800,
    shortDescription:
      "You've broken through every barrier \u2014 this is what excellence looks like.",
    description:
      "A nova is a star that suddenly shines thousands of times brighter. That's you right now. You've pushed past plateaus, built unshakable routines, and turned your ambitions into daily practice. Your consistency isn't luck \u2014 it's the result of hundreds of deliberate choices. You're operating at a level few ever reach.",
  },
  {
    tier: 8,
    title: "Pulsar",
    lightRequired: 5000,
    shortDescription:
      "Relentless, rhythmic, unstoppable \u2014 you pulse with purpose.",
    description:
      "Like a pulsar beaming light across the cosmos with perfect precision, your rhythm is unbreakable. You don't skip days. You don't make excuses. Your productivity system runs like clockwork, and your growth is measurable, visible, and undeniable. You've turned self-improvement from a goal into a lifestyle.",
  },
  {
    tier: 9,
    title: "Supernova",
    lightRequired: 8500,
    shortDescription:
      "You're a force of nature \u2014 your dedication rewrites what's possible.",
    description:
      "A supernova is the most powerful event in the universe, and your journey mirrors that intensity. You've accumulated thousands of light points through sheer will and consistency. Your perfect day streaks, your completed tasks, your rich journal entries \u2014 they tell the story of someone who refused to settle for average. You are extraordinary.",
  },
  {
    tier: 10,
    title: "Meridian",
    lightRequired: 13000,
    shortDescription:
      "You've reached the peak \u2014 the highest point of your journey. Legendary.",
    description:
      "You've arrived at the Meridian \u2014 the highest point the sky can offer. This isn't just a tier; it's a testament to an extraordinary commitment to growth. Every light point represents a moment you chose discipline over distraction, progress over comfort. You've journeyed from a single star in the night sky to the brightest force in the cosmos. You are the Meridian.",
  },
];

export function getNextTier(currentTier: number): LightTier | null {
  if (currentTier >= 10) return null;
  return LIGHT_TIERS[currentTier] ?? null;
}

export function getTierProgress(
  totalLight: number,
  currentTier: number,
): number {
  const current = LIGHT_TIERS[currentTier - 1];
  const next = LIGHT_TIERS[currentTier];
  if (!current || !next) return 100;
  const range = next.lightRequired - current.lightRequired;
  const progress = totalLight - current.lightRequired;
  return Math.min(100, Math.round((progress / range) * 100));
}
