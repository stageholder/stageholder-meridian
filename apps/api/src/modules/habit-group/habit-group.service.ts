import { Injectable, NotFoundException } from "@nestjs/common";
import type { StageholderUser } from "@stageholder/sdk/core";
import { HabitGroupRepository } from "./habit-group.repository";
import { HabitGroup } from "./habit-group.entity";
import {
  CreateHabitGroupDto,
  UpdateHabitGroupDto,
  ReorderHabitGroupsDto,
} from "./habit-group.dto";
import { HabitRepository } from "../habit/habit.repository";
import { enforceLimit } from "../../common/helpers/entitlement";

// Seeded once on first access. Editable/deletable like any group.
const TIME_OF_DAY_SEED: { name: string; color: string; icon: string }[] = [
  { name: "Morning", color: "#f59e0b", icon: "🌅" },
  { name: "Afternoon", color: "#0ea5e9", icon: "☀️" },
  { name: "Evening", color: "#6366f1", icon: "🌙" },
  { name: "Anytime", color: "#64748b", icon: "✨" },
];

@Injectable()
export class HabitGroupService {
  constructor(
    private readonly repository: HabitGroupRepository,
    private readonly habitRepository: HabitRepository,
  ) {}

  /**
   * Seed the four time-of-day groups, but ONLY if the user has never had any
   * group (count includes soft-deleted). Guarantees deleting all four does not
   * re-spawn them.
   */
  private async ensureSeed(userSub: string): Promise<void> {
    const everHad = await this.repository.countAllForUser(userSub);
    if (everHad > 0) return;
    for (let i = 0; i < TIME_OF_DAY_SEED.length; i++) {
      const seed = TIME_OF_DAY_SEED[i]!;
      await this.repository.seedDefault(userSub, String(i), {
        name: seed.name,
        color: seed.color,
        icon: seed.icon,
        order: i,
      });
    }
  }

  async create(
    userSub: string,
    dto: CreateHabitGroupDto,
    user: StageholderUser,
  ): Promise<HabitGroup> {
    const currentCount = await this.repository.countForUser(userSub);
    await enforceLimit(user, "max_habit_groups", async () => currentCount);
    const order = currentCount;
    const result = HabitGroup.create({
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      order,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByUser(
    userSub: string,
  ): Promise<ReturnType<HabitGroup["toObject"]>[]> {
    await this.ensureSeed(userSub);
    const groups = await this.repository.findByUser(userSub);
    return groups.map((g) => g.toObject());
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<ReturnType<HabitGroup["toObject"]>[]> {
    const groups = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return groups.map((g) => g.toObject());
  }

  async findById(userSub: string, id: string): Promise<HabitGroup> {
    const group = await this.repository.findById(userSub, id);
    if (!group) throw new NotFoundException("Habit group not found");
    return group;
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateHabitGroupDto,
  ): Promise<HabitGroup> {
    const group = await this.findById(userSub, id);
    if (dto.name) group.updateName(dto.name);
    if (dto.color !== undefined) group.updateColor(dto.color);
    if (dto.icon !== undefined) group.updateIcon(dto.icon);
    await this.repository.save(group);
    return group;
  }

  async reorder(userSub: string, dto: ReorderHabitGroupsDto): Promise<void> {
    for (const item of dto.items) {
      const group = await this.repository.findById(userSub, item.id);
      if (group) {
        group.updateOrder(item.order);
        await this.repository.save(group);
      }
    }
  }

  /** Soft-delete the group and ORPHAN its habits (group_id → null). */
  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.habitRepository.clearGroup(userSub, id);
    await this.repository.delete(userSub, id);
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
