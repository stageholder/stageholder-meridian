import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { HabitService } from "./habit.service";
import { Habit } from "./habit.entity";

function makeHabit(overrides: Partial<Record<string, unknown>> = {}): Habit {
  const result = Habit.create({
    name: (overrides.name as string) ?? "Exercise",
    description: (overrides.description as string) ?? "Daily exercise",
    frequency: "daily",
    targetCount: (overrides.targetCount as number) ?? 1,
    workspaceId: (overrides.workspaceId as string) ?? "ws-1",
    creatorId: (overrides.creatorId as string) ?? "user-1",
  });
  if (!result.ok) throw new Error("Failed to create test habit");
  return result.value;
}

const mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),
  findByWorkspace: vi.fn(),
  findByWorkspacePaginated: vi.fn(),
  delete: vi.fn(),
};

const mockMemberService = {
  requireRole: vi.fn(),
};

describe("HabitService", () => {
  let service: HabitService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemberService.requireRole.mockResolvedValue(undefined);
    service = new HabitService(mockRepository as any, mockMemberService as any);
  });

  describe("create", () => {
    it("should create a habit and save it", async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const habit = await service.create("ws-1", "user-1", {
        name: "Meditate",
        frequency: "daily",
        targetCount: 1,
      } as any);

      expect(habit.name).toBe("Meditate");
      expect(habit.workspaceId).toBe("ws-1");
      expect(habit.creatorId).toBe("user-1");
      expect(mockMemberService.requireRole).toHaveBeenCalledWith(
        "ws-1",
        "user-1",
        ["owner", "admin", "member"],
      );
      expect(mockRepository.save).toHaveBeenCalledOnce();
    });

    it("should default frequency to daily when not provided", async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const habit = await service.create("ws-1", "user-1", {
        name: "Read",
        targetCount: 1,
      } as any);

      expect(habit.frequency).toBe("daily");
    });

    it("should throw if name is empty", async () => {
      await expect(
        service.create("ws-1", "user-1", { name: "", targetCount: 1 } as any),
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("should return habit when found in the correct workspace", async () => {
      const habit = makeHabit();
      mockRepository.findById.mockResolvedValue(habit);

      const result = await service.findById(habit.id, "ws-1", "user-1");

      expect(result.id).toBe(habit.id);
    });

    it("should throw NotFoundException when habit is not found", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.findById("missing", "ws-1", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when habit belongs to a different workspace", async () => {
      const habit = makeHabit({ workspaceId: "ws-other" });
      mockRepository.findById.mockResolvedValue(habit);

      await expect(
        service.findById(habit.id, "ws-1", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByWorkspace", () => {
    it("should return all habits for a workspace", async () => {
      const habits = [makeHabit(), makeHabit({ name: "Read" })];
      mockRepository.findByWorkspace.mockResolvedValue(habits);

      const result = await service.findByWorkspace("ws-1", "user-1");

      expect(result).toHaveLength(2);
      expect(mockMemberService.requireRole).toHaveBeenCalledOnce();
    });
  });

  describe("update", () => {
    it("should update habit fields and save", async () => {
      const habit = makeHabit();
      mockRepository.findById.mockResolvedValue(habit);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.update(habit.id, "ws-1", "user-1", {
        name: "Run",
        frequency: "weekly",
        targetCount: 3,
      } as any);

      expect(result.name).toBe("Run");
      expect(result.frequency).toBe("weekly");
      expect(result.targetCount).toBe(3);
      expect(mockRepository.save).toHaveBeenCalledOnce();
    });

    it("should update optional fields like color and icon", async () => {
      const habit = makeHabit();
      mockRepository.findById.mockResolvedValue(habit);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await service.update(habit.id, "ws-1", "user-1", {
        color: "#ff0000",
        icon: "star",
      } as any);

      expect(result.color).toBe("#ff0000");
      expect(result.icon).toBe("star");
    });
  });

  describe("delete", () => {
    it("should delete a habit after verifying access", async () => {
      const habit = makeHabit();
      mockRepository.findById.mockResolvedValue(habit);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(habit.id, "ws-1", "user-1");

      expect(mockRepository.delete).toHaveBeenCalledWith(habit.id);
    });

    it("should throw NotFoundException when habit does not exist", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete("missing", "ws-1", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("listByWorkspace (paginated)", () => {
    it("should return paginated results", async () => {
      const habits = [makeHabit()];
      mockRepository.findByWorkspacePaginated.mockResolvedValue({
        docs: habits,
        total: 1,
      });

      const result = await service.listByWorkspace("ws-1", "user-1", 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("should clamp limit to MAX_LIMIT", async () => {
      mockRepository.findByWorkspacePaginated.mockResolvedValue({
        docs: [],
        total: 0,
      });

      await service.listByWorkspace("ws-1", "user-1", 1, 9999);

      expect(mockRepository.findByWorkspacePaginated).toHaveBeenCalledWith(
        "ws-1",
        1,
        500,
      );
    });
  });
});
