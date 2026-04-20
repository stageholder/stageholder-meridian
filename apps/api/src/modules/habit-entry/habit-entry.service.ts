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
    const habit = await this.habitRepository.findById(userSub, habitId);
    if (!habit) throw new NotFoundException("Habit not found");
    const isSkip = dto.type === "skip";
    const result = HabitEntry.create({
      habitId,
      date: dto.date,
      value: isSkip ? 0 : dto.value,
      type: dto.type,
      skipReason: dto.skipReason,
      notes: dto.notes,
      targetCountSnapshot: habit.targetCount,
      scheduledDaysSnapshot: habit.scheduledDays,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    if (!isSkip) {
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
    if (dto.value !== undefined) entry.updateValue(dto.value);
    if (dto.notes !== undefined) entry.updateNotes(dto.notes);
    await this.repository.save(entry);
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
