import { Injectable, NotFoundException } from "@nestjs/common";
import type { StageholderUser } from "@stageholder/sdk/core";
import { HabitRepository } from "./habit.repository";
import { Habit, HabitFrequency } from "./habit.entity";
import { CreateHabitDto, UpdateHabitDto, ReorderHabitsDto } from "./habit.dto";
import { enforceLimit } from "../../common/helpers/entitlement";
import {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class HabitService {
  constructor(private readonly repository: HabitRepository) {}

  async create(
    userSub: string,
    dto: CreateHabitDto,
    user: StageholderUser,
  ): Promise<Habit> {
    await enforceLimit(user, "max_habits", () =>
      this.repository.countActiveForUser(userSub),
    );
    const groupId = dto.groupId ?? null;
    const order = await this.repository.countByGroup(userSub, groupId);
    const result = Habit.create({
      name: dto.name,
      description: dto.description,
      frequency: dto.frequency || "daily",
      targetCount: dto.targetCount,
      scheduledDays: dto.scheduledDays,
      weeklyTarget: dto.weeklyTarget,
      unit: dto.unit,
      color: dto.color,
      icon: dto.icon,
      userSub,
      groupId,
      order,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByUser(userSub: string): Promise<Habit[]> {
    return this.repository.findByUser(userSub);
  }

  async listByUser(userSub: string, page?: number, limit?: number) {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByUserPaginated(
      userSub,
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
  ) {
    const habits = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return habits.map((h) => h.toObject());
  }

  async findById(userSub: string, id: string): Promise<Habit> {
    const habit = await this.repository.findById(userSub, id);
    if (!habit) throw new NotFoundException("Habit not found");
    return habit;
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateHabitDto,
  ): Promise<Habit> {
    const habit = await this.findById(userSub, id);
    if (dto.name) habit.updateName(dto.name);
    if (dto.description !== undefined) habit.updateDescription(dto.description);
    if (dto.frequency) habit.updateFrequency(dto.frequency as HabitFrequency);
    if (dto.targetCount !== undefined) habit.updateTargetCount(dto.targetCount);
    if (dto.scheduledDays !== undefined)
      habit.updateScheduledDays(dto.scheduledDays ?? undefined);
    if (dto.weeklyTarget !== undefined)
      habit.updateWeeklyTarget(dto.weeklyTarget ?? undefined);
    if (dto.unit !== undefined) habit.updateUnit(dto.unit);
    if (dto.color !== undefined) habit.updateColor(dto.color);
    if (dto.icon !== undefined) habit.updateIcon(dto.icon);
    if (dto.groupId !== undefined) habit.updateGroupId(dto.groupId ?? null);
    await this.repository.save(habit);
    return habit;
  }

  async archive(userSub: string, id: string): Promise<Habit> {
    const habit = await this.findById(userSub, id);
    habit.archive();
    await this.repository.save(habit);
    return habit;
  }

  async unarchive(userSub: string, id: string): Promise<Habit> {
    const habit = await this.findById(userSub, id);
    habit.unarchive();
    await this.repository.save(habit);
    return habit;
  }

  async reorder(userSub: string, dto: ReorderHabitsDto): Promise<void> {
    for (const item of dto.items) {
      const habit = await this.repository.findById(userSub, item.id);
      if (!habit || habit.archivedAt) continue;
      habit.updateOrder(item.order);
      if (item.groupId !== undefined) habit.updateGroupId(item.groupId ?? null);
      await this.repository.save(habit);
    }
  }

  async listArchived(userSub: string) {
    const habits = await this.repository.findArchivedByUser(userSub);
    return habits.map((h) => h.toObject());
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every habit for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
