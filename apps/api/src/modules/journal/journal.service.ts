import { Injectable, NotFoundException } from '@nestjs/common';
import { JournalRepository } from './journal.repository';
import { Journal } from './journal.entity';
import { CreateJournalDto, UpdateJournalDto } from './journal.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';

@Injectable()
export class JournalService {
  constructor(private readonly repository: JournalRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(workspaceId: string, userId: string, dto: CreateJournalDto): Promise<Journal> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const result = Journal.create({ title: dto.title, content: dto.content, mood: dto.mood, tags: dto.tags || [], workspaceId, authorId: userId, date: dto.date });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findById(id: string, workspaceId: string, userId: string): Promise<Journal> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const journal = await this.repository.findById(id);
    if (!journal || journal.workspaceId !== workspaceId) throw new NotFoundException('Journal not found');
    return journal;
  }

  async listByWorkspace(workspaceId: string, userId: string, startDate?: string, endDate?: string): Promise<Journal[]> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    if (startDate && endDate) {
      return this.repository.findByDateRange(workspaceId, startDate, endDate);
    }
    return this.repository.findByWorkspace(workspaceId);
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
