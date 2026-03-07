import { Injectable, NotFoundException } from '@nestjs/common';
import { JournalRepository } from './journal.repository';
import { Journal } from './journal.entity';
import { CreateJournalDto, UpdateJournalDto } from './journal.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { LightService } from '../light/light.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class JournalService {
  constructor(private readonly repository: JournalRepository, private readonly memberService: WorkspaceMemberService, private readonly lightService: LightService) {}

  async create(workspaceId: string, userId: string, dto: CreateJournalDto): Promise<Journal> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const result = Journal.create({ title: dto.title, content: dto.content, mood: dto.mood, tags: dto.tags || [], workspaceId, authorId: userId, date: dto.date });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    this.lightService.awardJournalEntry(userId, workspaceId, result.value.id).catch(() => {});
    return result.value;
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<Journal> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const journal = await this.repository.findById(id);
    if (!journal || journal.workspaceId !== workspaceId) throw new NotFoundException('Journal not found');
    return journal;
  }

  async listByWorkspace(workspaceId: string, userId: string, startDate?: string, endDate?: string, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<Journal['toObject']>>> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    if (startDate && endDate) {
      const journals = await this.repository.findByDateRange(workspaceId, startDate, endDate);
      return { data: journals.map((j) => j.toObject()), meta: buildPaginationMeta(journals.length, 1, journals.length || 1) };
    }
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspacePaginated(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateJournalDto): Promise<Journal> {
    const journal = await this.findById(id, workspaceId, userId);
    if (dto.title) journal.updateTitle(dto.title);
    if (dto.content !== undefined) journal.updateContent(dto.content);
    if (dto.mood !== undefined) journal.updateMood(dto.mood ?? undefined);
    if (dto.tags) journal.updateTags(dto.tags);
    if (dto.date) journal.updateDate(dto.date);
    await this.repository.save(journal);
    return journal;
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
