import { Entity, EntityProps, Ok, Result } from "../../../shared";
import { getTierForLight, DEFAULT_TARGETS } from "./light-config";

export interface UserLightProps extends EntityProps {
  userSub: string;
  totalLight: number;
  currentTier: number;
  currentTitle: string;
  perfectDayStreak: number;
  todoRingStreak: number;
  habitRingStreak: number;
  journalRingStreak: number;
  lastActiveDate: string | null;
  /** The date on which streaks were last finalized (end-of-day evaluation). */
  lastFinalizedDate: string | null;
  /** Streak values frozen at the last finalize — used as a stable baseline
   *  so recompute mode can derive idempotent target values. */
  finalizedStreaks: {
    todo: number;
    habit: number;
    journal: number;
    perfect: number;
  } | null;
  longestPerfectStreak: number;
  perfectDaysTotal: number;
  todoTargetDaily: number;
  journalTargetDailyWords: number;
}

export class UserLight extends Entity<UserLightProps> {
  private constructor(props: UserLightProps, id?: string) {
    super(props, id);
  }

  get userSub(): string {
    return this.get("userSub");
  }
  get totalLight(): number {
    return this.get("totalLight");
  }
  get currentTier(): number {
    return this.get("currentTier");
  }
  get currentTitle(): string {
    return this.get("currentTitle");
  }
  get perfectDayStreak(): number {
    return this.get("perfectDayStreak");
  }
  get todoRingStreak(): number {
    return this.get("todoRingStreak");
  }
  get habitRingStreak(): number {
    return this.get("habitRingStreak");
  }
  get journalRingStreak(): number {
    return this.get("journalRingStreak");
  }
  get lastActiveDate(): string | null {
    return this.get("lastActiveDate");
  }
  get lastFinalizedDate(): string | null {
    return this.get("lastFinalizedDate");
  }
  get finalizedStreaks(): {
    todo: number;
    habit: number;
    journal: number;
    perfect: number;
  } | null {
    return this.get("finalizedStreaks");
  }
  get longestPerfectStreak(): number {
    return this.get("longestPerfectStreak");
  }
  get perfectDaysTotal(): number {
    return this.get("perfectDaysTotal");
  }
  get todoTargetDaily(): number {
    return this.get("todoTargetDaily");
  }
  get journalTargetDailyWords(): number {
    return this.get("journalTargetDailyWords");
  }

  updateTargets(targets: {
    todoTargetDaily?: number;
    journalTargetDailyWords?: number;
  }): void {
    if (targets.todoTargetDaily !== undefined)
      this.set("todoTargetDaily", targets.todoTargetDaily);
    if (targets.journalTargetDailyWords !== undefined)
      this.set("journalTargetDailyWords", targets.journalTargetDailyWords);
  }

  addLight(amount: number): void {
    this.set("totalLight", this.totalLight + amount);
    const tier = getTierForLight(this.totalLight);
    this.set("currentTier", tier.tier);
    this.set("currentTitle", tier.title);
  }

  updateStreaks(streaks: {
    perfectDayStreak: number | null;
    todoRingStreak: number | null;
    habitRingStreak: number | null;
    journalRingStreak: number | null;
    lastActiveDate: string;
    lastFinalizedDate?: string;
    finalizedStreaks?: {
      todo: number;
      habit: number;
      journal: number;
      perfect: number;
    };
  }): void {
    if (streaks.perfectDayStreak !== null) {
      this.set("perfectDayStreak", streaks.perfectDayStreak);
      if (streaks.perfectDayStreak > this.longestPerfectStreak) {
        this.set("longestPerfectStreak", streaks.perfectDayStreak);
      }
    }
    if (streaks.todoRingStreak !== null)
      this.set("todoRingStreak", streaks.todoRingStreak);
    if (streaks.habitRingStreak !== null)
      this.set("habitRingStreak", streaks.habitRingStreak);
    if (streaks.journalRingStreak !== null)
      this.set("journalRingStreak", streaks.journalRingStreak);
    this.set("lastActiveDate", streaks.lastActiveDate);
    if (streaks.lastFinalizedDate !== undefined)
      this.set("lastFinalizedDate", streaks.lastFinalizedDate);
    if (streaks.finalizedStreaks !== undefined)
      this.set("finalizedStreaks", streaks.finalizedStreaks);
  }

  setLastActiveDate(date: string): void {
    this.set("lastActiveDate", date);
  }

  incrementPerfectDays(): void {
    this.set("perfectDaysTotal", this.perfectDaysTotal + 1);
  }

  static create(userSub: string): Result<UserLight> {
    const userLight = new UserLight({
      userSub,
      totalLight: 0,
      currentTier: 1,
      currentTitle: "Stargazer",
      perfectDayStreak: 0,
      todoRingStreak: 0,
      habitRingStreak: 0,
      journalRingStreak: 0,
      lastActiveDate: null,
      lastFinalizedDate: null,
      finalizedStreaks: null,
      longestPerfectStreak: 0,
      perfectDaysTotal: 0,
      todoTargetDaily: DEFAULT_TARGETS.todoDaily,
      journalTargetDailyWords: DEFAULT_TARGETS.journalDailyWords,
    });
    return Ok(userLight);
  }

  static reconstitute(props: UserLightProps, id: string): UserLight {
    return new UserLight(props, id);
  }
}
