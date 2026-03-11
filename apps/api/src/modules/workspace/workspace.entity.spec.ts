import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.entity";

describe("Workspace Entity", () => {
  const validProps = {
    name: "My Workspace",
    description: "A test workspace",
    ownerId: "owner-123",
  };

  describe("create()", () => {
    it("should create a workspace with valid props", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("My Workspace");
        expect(result.value.shortId).toHaveLength(12);
        expect(result.value.description).toBe("A test workspace");
        expect(result.value.ownerId).toBe("owner-123");
        expect(result.value.id).toBeDefined();
      }
    });

    it("should auto-generate a 12-char shortId", () => {
      const result = Workspace.create({
        ...validProps,
        name: "Hello World Project",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.shortId).toHaveLength(12);
        expect(typeof result.value.shortId).toBe("string");
      }
    });

    it("should create without description", () => {
      const result = Workspace.create({
        name: "No Description",
        ownerId: "owner-123",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBeUndefined();
      }
    });

    it("should fail with empty name", () => {
      const result = Workspace.create({ ...validProps, name: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Workspace name is required");
      }
    });

    it("should fail with whitespace-only name", () => {
      const result = Workspace.create({ ...validProps, name: "   " });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Workspace name is required");
      }
    });

    it("should fail with empty ownerId", () => {
      const result = Workspace.create({ ...validProps, ownerId: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Owner is required");
      }
    });
  });

  describe("reconstitute()", () => {
    it("should reconstitute a workspace with all props and id", () => {
      const id = "existing-ws-id";
      const props = {
        ...validProps,
        shortId: "Kx7Tz9mQ5p2R",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };
      const workspace = Workspace.reconstitute(props, id);
      expect(workspace.id).toBe(id);
      expect(workspace.name).toBe("My Workspace");
      expect(workspace.shortId).toBe("Kx7Tz9mQ5p2R");
      expect(workspace.ownerId).toBe("owner-123");
      expect(workspace.createdAt).toEqual(new Date("2024-01-01"));
      expect(workspace.updatedAt).toEqual(new Date("2024-01-02"));
    });
  });

  describe("toObject()", () => {
    it("should return all properties including base entity fields", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.name).toBe("My Workspace");
        expect(obj.shortId).toHaveLength(12);
        expect(obj.description).toBe("A test workspace");
        expect(obj.ownerId).toBe("owner-123");
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe("Business methods", () => {
    it("should update name without changing shortId", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        const originalShortId = workspace.shortId;
        workspace.updateName("New Workspace Name");
        expect(workspace.name).toBe("New Workspace Name");
        expect(workspace.shortId).toBe(originalShortId);
      }
    });

    it("should update description and touch updatedAt", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        const originalUpdatedAt = workspace.updatedAt;
        workspace.updateDescription("Updated description");
        expect(workspace.description).toBe("Updated description");
        expect(workspace.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime(),
        );
      }
    });
  });

  describe("softDelete() and restore()", () => {
    it("should soft delete a workspace", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        expect(workspace.isDeleted).toBe(false);
        workspace.softDelete();
        expect(workspace.isDeleted).toBe(true);
        expect(workspace.deletedAt).toBeInstanceOf(Date);
      }
    });

    it("should restore a soft-deleted workspace", () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        workspace.softDelete();
        expect(workspace.isDeleted).toBe(true);
        workspace.restore();
        expect(workspace.isDeleted).toBe(false);
        expect(workspace.deletedAt).toBeUndefined();
      }
    });
  });

  describe("equals()", () => {
    it("should return true for entities with the same id", () => {
      const id = "same-id";
      const ws1 = Workspace.reconstitute(
        { ...validProps, shortId: "Kx7Tz9mQ5p2R" },
        id,
      );
      const ws2 = Workspace.reconstitute(
        { ...validProps, shortId: "Kx7Tz9mQ5p2R", name: "Different" },
        id,
      );
      expect(ws1.equals(ws2)).toBe(true);
    });

    it("should return false for entities with different ids", () => {
      const ws1 = Workspace.reconstitute(
        { ...validProps, shortId: "Kx7Tz9mQ5p2R" },
        "id-1",
      );
      const ws2 = Workspace.reconstitute(
        { ...validProps, shortId: "Ab3Cd5eF7g8H" },
        "id-2",
      );
      expect(ws1.equals(ws2)).toBe(false);
    });

    it("should return false when compared with undefined", () => {
      const ws = Workspace.reconstitute(
        { ...validProps, shortId: "Kx7Tz9mQ5p2R" },
        "id-1",
      );
      expect(ws.equals(undefined)).toBe(false);
    });
  });
});
