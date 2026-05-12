import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { HabitEntryRepository } from "./habit-entry.repository";
import { HabitEntry } from "./habit-entry.entity";
import { CreateHabitEntryDto, UpdateHabitEntryDto } from "./habit-entry.dto";
import { LightService } from "../light/light.service";
import { HabitRepository } from "../habit/habit.repository";
import {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class HabitEntryService {
  private readonly logger = new Logger(HabitEntryService.name);
  constructor(
    private readonly repository: HabitEntryRepository,
    private readonly lightService: LightService,
    private readonly habitRepository: HabitRepository,
  ) {}

  async create(
    userSub: string,
    habitId: string,
    dto: CreateHabitEntryDto,
  ): Promise<HabitEntry> {
    const existing = await this.repository.findByHabitAndDate(
      userSub,
      habitId,
      dto.date,
    );
    if (existing)
      throw new ConflictException(
        "Entry already exists for this habit on this date",
      );
    // findByHabitAndDate filters `deleted_at: null`, but the Mongo unique
    // index on (userSub, habit_id, date) does NOT. So a soft-deleted ghost
    // still occupies the slot and would crash this insert with E11000.
    // Sweep it before inserting — safe because the ghost was already
    // trashed by an earlier delete().
    await this.repository.hardDeleteGhost(userSub, habitId, dto.date);
    const habit = await this.habitRepository.findById(userSub, habitId);
    if (!habit) throw new NotFoundException("Habit not found");
    const isNonCompletion = dto.type === "skip" || dto.type === "fail";
    const result = HabitEntry.create({
      habitId,
      date: dto.date,
      value: isNonCompletion ? 0 : dto.value,
      type: dto.type,
      skipReason: dto.skipReason,
      notes: dto.notes,
      targetCountSnapshot: habit.targetCount,
      scheduledDaysSnapshot: habit.scheduledDays,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    if (!isNonCompletion) {
      await this.lightService
        .awardHabitCheckin(userSub, habitId, result.value.id)
        .catch((err) => this.logger.warn("Failed to award light", err.message));
    }
    return result.value;
  }

  async findById(userSub: string, id: string): Promise<HabitEntry> {
    const entry = await this.repository.findById(userSub, id);
    if (!entry) throw new NotFoundException("Habit entry not found");
    return entry;
  }

  async listByHabit(
    userSub: string,
    habitId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HabitEntry[]> {
    if (startDate && endDate) {
      return this.repository.findByHabitAndDateRange(
        userSub,
        habitId,
        startDate,
        endDate,
      );
    }
    return this.repository.findByHabit(userSub, habitId);
  }

  async listByHabitPaginated(
    userSub: string,
    habitId: string,
    page?: number,
    limit?: number,
  ) {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByHabitPaginated(
      userSub,
      habitId,
      p,
      l,
    );
    return {
      data: docs.map((d) => d.toObject()),
      meta: buildPaginationMeta(total, p, l),
    };
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<HabitEntry[]> {
    return this.repository.findUpdatedSince(userSub, since, includeSoftDeleted);
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateHabitEntryDto,
  ): Promise<HabitEntry> {
    const entry = await this.findById(userSub, id);
    const wasNonCompletion = entry.type === "skip" || entry.type === "fail";
    // Apply type first: switching to skip/fail forces value to 0, so applying
    // a caller-supplied value AFTER type avoids the new value being clobbered
    // by the invariant.
    if (dto.type !== undefined) entry.updateType(dto.type);
    if (dto.value !== undefined) entry.updateValue(dto.value);
    if (dto.notes !== undefined) entry.updateNotes(dto.notes);
    if (dto.skipReason !== undefined) entry.updateSkipReason(dto.skipReason);
    await this.repository.save(entry);
    // Promoting a non-completion (skip or fail) into a completion is
    // functionally equivalent to having created a completion in the first
    // place — award the light here. awardHabitCheckin is idempotent per
    // (userSub, "habit_checkin", date, entryId).
    const becameCompletion: boolean = entry.type === "completion";
    if (wasNonCompletion && becameCompletion) {
      await this.lightService
        .awardHabitCheckin(userSub, entry.habitId, entry.id)
        .catch((err) => this.logger.warn("Failed to award light", err.message));
    }
    return entry;
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every habit entry for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
