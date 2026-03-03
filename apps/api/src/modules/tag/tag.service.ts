import { Injectable, NotFoundException } from '@nestjs/common';
import { TagRepository } from './tag.repository';
import { Tag } from './tag.entity';
import { CreateTagDto, UpdateTagDto } from './tag.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class TagService {
  constructor(private readonly repository: TagRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(workspaceId: string, userId: string, dto: CreateTagDto): Promise<Tag> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const result = Tag.create({ name: dto.name, color: dto.color, workspaceId });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByWorkspace(workspaceId: string, userId: string): Promise<Tag[]> {
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

  async findById(id: string, workspaceId: string, userId: string): Promise<Tag> {
    await this.memberService.requireRole(workspaceId, userId, ['owner', 'admin', 'member']);
    const tag = await this.repository.findById(id);
    if (!tag || tag.workspaceId !== workspaceId) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findById(id, workspaceId, userId);
    if (dto.name) tag.updateName(dto.name);
    if (dto.color) tag.updateColor(dto.color);
    await this.repository.save(tag);
    return tag;
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.findById(id, workspaceId, userId);
    await this.repository.delete(id);
  }
}
