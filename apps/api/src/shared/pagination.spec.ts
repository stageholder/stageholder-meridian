import { describe, it, expect } from "vitest";
import {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "./pagination";

describe("Pagination", () => {
  describe("buildPaginationMeta", () => {
    it("should calculate meta for a first page", () => {
      const meta = buildPaginationMeta(100, 1, 20);
      expect(meta).toEqual({
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should calculate meta for a middle page", () => {
      const meta = buildPaginationMeta(100, 3, 20);
      expect(meta).toEqual({
        total: 100,
        page: 3,
        limit: 20,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("should calculate meta for the last page", () => {
      const meta = buildPaginationMeta(100, 5, 20);
      expect(meta).toEqual({
        total: 100,
        page: 5,
        limit: 20,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("should handle single page of results", () => {
      const meta = buildPaginationMeta(5, 1, 20);
      expect(meta).toEqual({
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should handle zero total items", () => {
      const meta = buildPaginationMeta(0, 1, 20);
      expect(meta).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should handle total not evenly divisible by limit", () => {
      const meta = buildPaginationMeta(25, 1, 10);
      expect(meta).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should handle exactly one full page", () => {
      const meta = buildPaginationMeta(20, 1, 20);
      expect(meta).toEqual({
        total: 20,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should handle limit of 1", () => {
      const meta = buildPaginationMeta(3, 2, 1);
      expect(meta).toEqual({
        total: 3,
        page: 2,
        limit: 1,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("should handle large datasets", () => {
      const meta = buildPaginationMeta(10000, 50, 100);
      expect(meta).toEqual({
        total: 10000,
        page: 50,
        limit: 100,
        totalPages: 100,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  describe("Constants", () => {
    it("should export DEFAULT_PAGE as 1", () => {
      expect(DEFAULT_PAGE).toBe(1);
    });

    it("should export DEFAULT_LIMIT as 20", () => {
      expect(DEFAULT_LIMIT).toBe(20);
    });

    it("should export MAX_LIMIT as 500", () => {
      expect(MAX_LIMIT).toBe(500);
    });
  });
});
