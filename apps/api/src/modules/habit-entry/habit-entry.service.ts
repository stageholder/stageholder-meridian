import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { HabitEntryRepository } from './habit-entry.repository';
import { HabitEntry } from './habit-entry.entity';
import { CreateHabitEntryDto, UpdateHabitEntryDto } from './habit-entry.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { LightService } from '../light/light.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class HabitEntryService {
  private readonly logger = new Logger(HabitEntryService.name);
  constructor(private readonly repository: HabitEntryRepository, private readonly memberService: WorkspaceMemberService, private readonly lightService: LightService) {}

  async create(habitId: string, workspaceId: string, userId: string, dto: CreateHabitEntryDto): Promise<HabitEntry> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const existing = await this.repository.findByHabitAndDate(habitId, dto.date);
    if (existing) throw new ConflictException('Entry already exists for this habit on this date');
    const result = HabitEntry.create({ habitId, date: dto.date, value: dto.value, notes: dto.notes, workspaceId });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    await this.lightService.awardHabitCheckin(userId, workspaceId, habitId, result.value.id).catch((err) => this.logger.warn('Failed to award light', err.message));
    return result.value;
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<HabitEntry> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const entry = await this.repository.findById(id);
    if (!entry || entry.workspaceId !== workspaceId) throw new NotFoundException('Habit entry not found');
    return entry;
  }

  async listByHabit(habitId: string, workspaceId: string, userId: string, startDate?: string, endDate?: string): Promise<HabitEntry[]> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    if (startDate && endDate) {
      return this.repository.findByHabitAndDateRange(habitId, startDate, endDate);
    }
    return this.repository.findByHabit(habitId);
  }

  async listByHabitPaginated(habitId: string, workspaceId: string, userId: string, page?: number, limit?: number) {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByHabitPaginated(habitId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateHabitEntryDto): Promise<HabitEntry> {
    const entry = await this.findById(id, workspaceId, userId);
    if (dto.value !== undefined) entry.updateValue(dto.value);
    if (dto.notes !== undefined) entry.updateNotes(dto.notes);
    await this.repository.save(entry);
    return entry;
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
