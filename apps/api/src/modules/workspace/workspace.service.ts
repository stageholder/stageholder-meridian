import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { WorkspaceRepository } from './workspace.repository';
import { Workspace } from './workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspace.dto';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';

@Injectable()
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository, private readonly memberService: WorkspaceMemberService) {}

  async create(userId: string, email: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const result = Workspace.create({ name: dto.name, description: dto.description, ownerId: userId });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    await this.memberService.addOwner(result.value.id, userId, email);
    return result.value;
  }

  async findByUser(userId: string): Promise<Workspace[]> {
    const memberships = await this.memberService.getUserMemberships(userId);
    const workspaces: Workspace[] = [];
    for (const m of memberships) { const ws = await this.repository.findById(m.workspaceId); if (ws) workspaces.push(ws); }
    return workspaces;
  }

  async findById(id: string, userId?: string): Promise<Workspace> {
    const ws = await this.repository.findById(id);
    if (!ws) throw new NotFoundException('Workspace not found');
    if (userId) await this.memberService.requireRole(id, userId, ['owner', 'admin', 'member', 'viewer']);
    return ws;
  }

  async findByShortId(shortId: string, userId: string): Promise<Workspace> {
    const ws = await this.repository.findByShortId(shortId);
    if (!ws) throw new NotFoundException('Workspace not found');
    await this.memberService.requireRole(ws.id, userId, ['owner', 'admin', 'member', 'viewer']);
    return ws;
  }

  async resolve(identifier: string, userId: string): Promise<Workspace> {
    const ws = identifier.includes('-')
      ? await this.repository.findById(identifier)
      : await this.repository.findByShortId(identifier);
    if (!ws) throw new NotFoundException('Workspace not found');
    await this.memberService.requireRole(ws.id, userId, ['owner', 'admin', 'member', 'viewer']);
    return ws;
  }

  async update(id: string, userId: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const ws = await this.findById(id);
    await this.memberService.requireRole(id, userId, ['owner', 'admin']);
    if (dto.name) ws.updateName(dto.name);
    if (dto.description !== undefined) ws.updateDescription(dto.description);
    await this.repository.save(ws);
    return ws;
  }

  async delete(id: string, userId: string): Promise<void> {
    const ws = await this.findById(id);
    if (ws.ownerId !== userId) throw new ForbiddenException('Only the owner can delete a workspace');
    await this.repository.delete(id);
  }
}
