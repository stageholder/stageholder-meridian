import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WorkspaceMemberRepository } from './workspace-member.repository';
import { WorkspaceMember, MemberRole } from './workspace-member.entity';
import { InviteMemberDto, UpdateMemberRoleDto } from './workspace-member.dto';
import { PaginatedResult, buildPaginationMeta, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../shared';

@Injectable()
export class WorkspaceMemberService {
  constructor(private readonly repository: WorkspaceMemberRepository) {}

  async addOwner(workspaceId: string, userId: string, email: string): Promise<WorkspaceMember> {
    const result = WorkspaceMember.create({ workspaceId, userId, email, role: 'owner', invitationStatus: 'accepted' });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async invite(workspaceId: string, dto: InviteMemberDto): Promise<WorkspaceMember> {
    const existing = await this.repository.findByWorkspaceAndEmail(workspaceId, dto.email);
    if (existing) throw new ConflictException('User already invited to this workspace');
    const token = randomUUID();
    const result = WorkspaceMember.create({ workspaceId, email: dto.email.toLowerCase(), role: dto.role as MemberRole, invitationStatus: 'pending', invitationToken: token });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async getInvitationByToken(token: string): Promise<WorkspaceMember | null> { return this.repository.findByToken(token); }

  async acceptInvitation(token: string, userId: string): Promise<WorkspaceMember> {
    const member = await this.repository.findByToken(token);
    if (!member) throw new NotFoundException('Invitation not found or already used');
    member.accept(userId);
    await this.repository.save(member);
    return member;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> { return this.repository.findByWorkspace(workspaceId); }

  async listMembersPaginated(workspaceId: string, page?: number, limit?: number): Promise<PaginatedResult<ReturnType<WorkspaceMember['toObject']>>> {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByWorkspacePaginated(workspaceId, p, l);
    return { data: docs.map((d) => d.toObject()), meta: buildPaginationMeta(total, p, l) };
  }

  async updateRole(memberId: string, workspaceId: string, dto: UpdateMemberRoleDto): Promise<WorkspaceMember> {
    const member = await this.repository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) throw new NotFoundException('Member not found');
    if (member.role === 'owner') throw new ForbiddenException('Cannot change owner role');
    member.updateRole(dto.role as MemberRole);
    await this.repository.save(member);
    return member;
  }

  async removeMember(memberId: string, workspaceId: string): Promise<void> {
    const member = await this.repository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) throw new NotFoundException('Member not found');
    if (member.role === 'owner') throw new ForbiddenException('Cannot remove workspace owner');
    await this.repository.delete(memberId);
  }

  async getUserMemberships(userId: string): Promise<WorkspaceMember[]> { return this.repository.findByUserId(userId); }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.repository.findByWorkspaceAndUser(workspaceId, userId);
    return !!member && member.invitationStatus === 'accepted';
  }

  async requireRole(workspaceId: string, userId: string, roles: MemberRole[]): Promise<WorkspaceMember> {
    const member = await this.repository.findByWorkspaceAndUser(workspaceId, userId);
    if (!member || member.invitationStatus !== 'accepted') throw new ForbiddenException('Not a member of this workspace');
    if (!roles.includes(member.role)) throw new ForbiddenException('Insufficient permissions');
    return member;
  }

  async listAcceptedMemberUserIds(workspaceId: string): Promise<string[]> {
    const members = await this.repository.findByWorkspace(workspaceId);
    return members.filter((m) => m.invitationStatus === 'accepted' && m.userId).map((m) => m.userId!);
  }
}
