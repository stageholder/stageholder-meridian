import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service";
import { Workspace } from "./workspace.entity";

function makeWorkspace(
  overrides: Partial<Record<string, unknown>> = {},
): Workspace {
  const result = Workspace.create({
    name: (overrides.name as string) ?? "Test Workspace",
    description: (overrides.description as string) ?? "A test workspace",
    ownerId: (overrides.ownerId as string) ?? "user-1",
    isPersonal: (overrides.isPersonal as boolean) ?? false,
  });
  if (!result.ok) throw new Error("Failed to create test workspace");
  return result.value;
}

const mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),
  findByIds: vi.fn(),
  findByShortId: vi.fn(),
  findPersonalByOwner: vi.fn(),
  delete: vi.fn(),
};

const mockMemberService = {
  addOwner: vi.fn(),
  requireRole: vi.fn(),
  getUserMemberships: vi.fn(),
};

describe("WorkspaceService", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemberService.requireRole.mockResolvedValue(undefined);
    mockMemberService.addOwner.mockResolvedValue(undefined);
    service = new WorkspaceService(
      mockRepository as any,
      mockMemberService as any,
    );
  });

  describe("create", () => {
    it("should create a workspace and add creator as owner", async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const ws = await service.create("user-1", "user@test.com", {
        name: "My Workspace",
        description: "Desc",
      });

      expect(ws.name).toBe("My Workspace");
      expect(ws.ownerId).toBe("user-1");
      expect(ws.shortId).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledOnce();
      expect(mockMemberService.addOwner).toHaveBeenCalledWith(
        ws.id,
        "user-1",
        "user@test.com",
      );
    });
  });

  describe("createPersonal", () => {
    it("should return existing personal workspace if one exists", async () => {
      const existing = makeWorkspace({ isPersonal: true });
      mockRepository.findPersonalByOwner.mockResolvedValue(existing);

      const result = await service.createPersonal(
        "user-1",
        "user@test.com",
        "User",
      );

      expect(result).toBe(existing);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should create a new personal workspace if none exists", async () => {
      mockRepository.findPersonalByOwner.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.createPersonal(
        "user-1",
        "user@test.com",
        "User",
      );

      expect(result.name).toBe("Personal");
      expect(mockRepository.save).toHaveBeenCalledOnce();
      expect(mockMemberService.addOwner).toHaveBeenCalledOnce();
    });
  });

  describe("findByUser", () => {
    it("should return workspaces the user is a member of", async () => {
      const ws1 = makeWorkspace({ name: "WS1" });
      const ws2 = makeWorkspace({ name: "WS2" });
      mockMemberService.getUserMemberships.mockResolvedValue([
        { workspaceId: "id-1" },
        { workspaceId: "id-2" },
      ]);
      mockRepository.findByIds.mockResolvedValue([ws1, ws2]);

      const result = await service.findByUser("user-1");

      expect(result).toHaveLength(2);
      expect(mockMemberService.getUserMemberships).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("should return empty array when user has no memberships", async () => {
      mockMemberService.getUserMemberships.mockResolvedValue([]);
      mockRepository.findByIds.mockResolvedValue([]);

      const result = await service.findByUser("user-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("findById", () => {
    it("should return workspace when found", async () => {
      const ws = makeWorkspace();
      mockRepository.findById.mockResolvedValue(ws);

      const result = await service.findById(ws.id);

      expect(result.id).toBe(ws.id);
    });

    it("should throw NotFoundException when workspace not found", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById("missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should check membership when userId is provided", async () => {
      const ws = makeWorkspace();
      mockRepository.findById.mockResolvedValue(ws);

      await service.findById(ws.id, "user-1");

      expect(mockMemberService.requireRole).toHaveBeenCalledWith(
        ws.id,
        "user-1",
        ["owner", "admin", "member", "viewer"],
      );
    });
  });

  describe("update", () => {
    it("should update name and description", async () => {
      const ws = makeWorkspace();
      mockRepository.findById.mockResolvedValue(ws);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.update(ws.id, "user-1", {
        name: "Renamed",
        description: "New desc",
      });

      expect(result.name).toBe("Renamed");
      expect(result.description).toBe("New desc");
      expect(mockRepository.save).toHaveBeenCalledOnce();
    });

    it("should require owner or admin role", async () => {
      const ws = makeWorkspace();
      mockRepository.findById.mockResolvedValue(ws);
      mockRepository.save.mockResolvedValue(undefined);

      await service.update(ws.id, "user-1", { name: "X" });

      // requireRole is called twice: once from findById path, once from update itself
      expect(mockMemberService.requireRole).toHaveBeenCalledWith(
        ws.id,
        "user-1",
        ["owner", "admin"],
      );
    });
  });

  describe("delete", () => {
    it("should delete a non-personal workspace owned by user", async () => {
      const ws = makeWorkspace({ ownerId: "user-1" });
      mockRepository.findById.mockResolvedValue(ws);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(ws.id, "user-1");

      expect(mockRepository.delete).toHaveBeenCalledWith(ws.id);
    });

    it("should throw ForbiddenException for personal workspace", async () => {
      const ws = makeWorkspace({ isPersonal: true, ownerId: "user-1" });
      mockRepository.findById.mockResolvedValue(ws);

      await expect(service.delete(ws.id, "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException if user is not the owner", async () => {
      const ws = makeWorkspace({ ownerId: "other-user" });
      mockRepository.findById.mockResolvedValue(ws);

      await expect(service.delete(ws.id, "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("resolve", () => {
    it("should resolve by UUID", async () => {
      const ws = makeWorkspace();
      mockRepository.findById.mockResolvedValue(ws);

      const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await service.resolve(uuid, "user-1");

      expect(mockRepository.findById).toHaveBeenCalledWith(uuid);
      expect(result).toBe(ws);
    });

    it("should resolve by shortId for non-UUID identifiers", async () => {
      const ws = makeWorkspace();
      mockRepository.findByShortId.mockResolvedValue(ws);

      const result = await service.resolve("abc123", "user-1");

      expect(mockRepository.findByShortId).toHaveBeenCalledWith("abc123");
      expect(result).toBe(ws);
    });

    it("should throw NotFoundException when identifier does not match", async () => {
      mockRepository.findById.mockResolvedValue(null);
      mockRepository.findByShortId.mockResolvedValue(null);

      await expect(service.resolve("nonexistent", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
