import { describe, it, expect } from "vitest";
import { Journal } from "./journal.entity";

describe("Journal Entity", () => {
  const validProps = {
    title: "My Day",
    content: "Today was a good day.",
    mood: 4,
    tags: ["personal", "gratitude"],
    workspaceId: "ws-123",
    authorId: "user-123",
    date: "2024-03-15",
    wordCount: 5,
  };

  describe("create()", () => {
    it("should create a journal with valid props", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("My Day");
        expect(result.value.content).toBe("Today was a good day.");
        expect(result.value.mood).toBe(4);
        expect(result.value.tags).toEqual(["personal", "gratitude"]);
        expect(result.value.workspaceId).toBe("ws-123");
        expect(result.value.authorId).toBe("user-123");
        expect(result.value.date).toBe("2024-03-15");
        expect(result.value.id).toBeDefined();
      }
    });

    it("should create without mood", () => {
      const result = Journal.create({ ...validProps, mood: undefined });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.mood).toBeUndefined();
      }
    });

    it("should default tags to empty array when not provided", () => {
      const result = Journal.create({
        ...validProps,
        tags: undefined as unknown as string[],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tags).toEqual([]);
      }
    });

    it("should fail with empty title", () => {
      const result = Journal.create({ ...validProps, title: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Journal title is required");
      }
    });

    it("should fail with whitespace-only title", () => {
      const result = Journal.create({ ...validProps, title: "   " });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Journal title is required");
      }
    });

    it("should fail with empty workspaceId", () => {
      const result = Journal.create({ ...validProps, workspaceId: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Workspace is required");
      }
    });

    it("should fail with empty authorId", () => {
      const result = Journal.create({ ...validProps, authorId: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Author is required");
      }
    });

    it("should fail with empty date", () => {
      const result = Journal.create({ ...validProps, date: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Date is required");
      }
    });

    it("should fail with mood less than 1", () => {
      const result = Journal.create({ ...validProps, mood: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Mood must be between 1 and 5");
      }
    });

    it("should fail with mood greater than 5", () => {
      const result = Journal.create({ ...validProps, mood: 6 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Mood must be between 1 and 5");
      }
    });

    it("should accept mood of 1 (minimum)", () => {
      const result = Journal.create({ ...validProps, mood: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.mood).toBe(1);
      }
    });

    it("should accept mood of 5 (maximum)", () => {
      const result = Journal.create({ ...validProps, mood: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.mood).toBe(5);
      }
    });
  });

  describe("reconstitute()", () => {
    it("should reconstitute a journal with all props and id", () => {
      const id = "existing-journal-id";
      const props = {
        ...validProps,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };
      const journal = Journal.reconstitute(props, id);
      expect(journal.id).toBe(id);
      expect(journal.title).toBe("My Day");
      expect(journal.content).toBe("Today was a good day.");
      expect(journal.mood).toBe(4);
      expect(journal.tags).toEqual(["personal", "gratitude"]);
      expect(journal.createdAt).toEqual(new Date("2024-01-01"));
    });
  });

  describe("toObject()", () => {
    it("should return all properties including base entity fields", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.title).toBe("My Day");
        expect(obj.content).toBe("Today was a good day.");
        expect(obj.mood).toBe(4);
        expect(obj.tags).toEqual(["personal", "gratitude"]);
        expect(obj.workspaceId).toBe("ws-123");
        expect(obj.authorId).toBe("user-123");
        expect(obj.date).toBe("2024-03-15");
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe("Business methods", () => {
    it("should update title and touch updatedAt", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        const originalUpdatedAt = journal.updatedAt;
        journal.updateTitle("Updated Title");
        expect(journal.title).toBe("Updated Title");
        expect(journal.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime(),
        );
      }
    });

    it("should update content", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.updateContent("New content here");
        expect(journal.content).toBe("New content here");
      }
    });

    it("should update mood", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.updateMood(2);
        expect(journal.mood).toBe(2);
      }
    });

    it("should clear mood with undefined", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.updateMood(undefined);
        expect(journal.mood).toBeUndefined();
      }
    });

    it("should update tags", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.updateTags(["work", "productivity"]);
        expect(journal.tags).toEqual(["work", "productivity"]);
      }
    });

    it("should update date", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.updateDate("2024-06-20");
        expect(journal.date).toBe("2024-06-20");
      }
    });
  });

  describe("softDelete() and restore()", () => {
    it("should soft delete a journal", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        expect(journal.isDeleted).toBe(false);
        journal.softDelete();
        expect(journal.isDeleted).toBe(true);
        expect(journal.deletedAt).toBeInstanceOf(Date);
      }
    });

    it("should restore a soft-deleted journal", () => {
      const result = Journal.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const journal = result.value;
        journal.softDelete();
        expect(journal.isDeleted).toBe(true);
        journal.restore();
        expect(journal.isDeleted).toBe(false);
        expect(journal.deletedAt).toBeUndefined();
      }
    });
  });

  describe("equals()", () => {
    it("should return true for entities with the same id", () => {
      const id = "same-id";
      const j1 = Journal.reconstitute(validProps, id);
      const j2 = Journal.reconstitute(
        { ...validProps, title: "Different" },
        id,
      );
      expect(j1.equals(j2)).toBe(true);
    });

    it("should return false for entities with different ids", () => {
      const j1 = Journal.reconstitute(validProps, "id-1");
      const j2 = Journal.reconstitute(validProps, "id-2");
      expect(j1.equals(j2)).toBe(false);
    });

    it("should return false when compared with undefined", () => {
      const journal = Journal.reconstitute(validProps, "id-1");
      expect(journal.equals(undefined)).toBe(false);
    });
  });
});
