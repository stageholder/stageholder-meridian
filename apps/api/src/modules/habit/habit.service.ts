import { Injectable, NotFoundException } from '@nestjs/common';
import { HabitRepository } from './habit.repository';
import { Habit, HabitFrequency } from './habit.entity';
import { CreateHabitDto, UpdateHabitDto } from './habit.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class HabitService {
  constructor(private readonly repository: HabitRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(workspaceId: string, userId: string, dto: CreateHabitDto): Promise<Habit> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const result = Habit.create({ name: dto.name, description: dto.description, frequency: dto.frequency || 'daily', targetCount: dto.targetCount, unit: dto.unit, color: dto.color, icon: dto.icon, workspaceId, creatorId: userId });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByWorkspace(workspaceId: string, userId: string): Promise<Habit[]> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    return this.repository.findByWorkspace(workspaceId);
  }

  async listByWorkspace(workspaceId: string, userId: string, page?: number, limit?: number) {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspacePaginated(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<Habit> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const habit = await this.repository.findById(id);
    if (!habit || habit.workspaceId !== workspaceId) throw new NotFoundException('Habit not found');
    return habit;
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateHabitDto): Promise<Habit> {
    const habit = await this.findById(id, workspaceId, userId);
    if (dto.name) habit.updateName(dto.name);
    if (dto.description !== undefined) habit.updateDescription(dto.description);
    if (dto.frequency) habit.updateFrequency(dto.frequency as HabitFrequency);
    if (dto.targetCount !== undefined) habit.updateTargetCount(dto.targetCount);
    if (dto.unit !== undefined) habit.updateUnit(dto.unit);
    if (dto.color !== undefined) habit.updateColor(dto.color);
    if (dto.icon !== undefined) habit.updateIcon(dto.icon);
    await this.repository.save(habit);
    return habit;
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
