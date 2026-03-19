import { describe, it, expect } from "vitest";
import {
  getText,
  toNum,
  parseRange,
  toWorkingSetCount,
  toWeight,
  toReps,
  toRir,
} from "../normalizeValues";

describe("normalizeValues", () => {
  describe("getText", () => {
    it("returns empty for null/undefined", () => {
      expect(getText(null)).toBe("");
      expect(getText(undefined)).toBe("");
    });
    it("trims string values", () => {
      expect(getText("  Week 1  ")).toBe("Week 1");
    });
    it("converts number to string", () => {
      expect(getText(135)).toBe("135");
      expect(getText(8)).toBe("8");
    });
  });

  describe("toNum", () => {
    it("parses string numbers", () => {
      expect(toNum("135")).toBe(135);
      expect(toNum("8")).toBe(8);
      expect(toNum(" 10 ")).toBe(10);
    });
    it("returns number as-is", () => {
      expect(toNum(50)).toBe(50);
    });
    it("returns undefined for empty or invalid", () => {
      expect(toNum("")).toBeUndefined();
      expect(toNum(null)).toBeUndefined();
      expect(toNum("abc")).toBeUndefined();
    });
  });

  describe("parseRange", () => {
    it("parses dash-separated ranges", () => {
      expect(parseRange("1-2")).toEqual({ min: 1, max: 2 });
      expect(parseRange("6-8")).toEqual({ min: 6, max: 8 });
      expect(parseRange("8-10")).toEqual({ min: 8, max: 10 });
    });
    it("handles unicode dash", () => {
      expect(parseRange("8–10")).toEqual({ min: 8, max: 10 });
    });
    it("returns null for non-range", () => {
      expect(parseRange("")).toBeNull();
      expect(parseRange("abc")).toBeNull();
      expect(parseRange("10")).toBeNull();
    });
  });

  describe("toWorkingSetCount", () => {
    it("parses valid counts", () => {
      expect(toWorkingSetCount(3)).toBe(3);
      expect(toWorkingSetCount("4")).toBe(4);
    });
    it("clamps to 0..99", () => {
      expect(toWorkingSetCount(-1)).toBe(0);
      expect(toWorkingSetCount(100)).toBe(99);
    });
  });

  describe("toWeight", () => {
    it("parses valid weight", () => {
      expect(toWeight(135)).toBe(135);
      expect(toWeight("62.5")).toBe(62.5);
    });
    it("returns undefined for negative or too large", () => {
      expect(toWeight(-1)).toBeUndefined();
      expect(toWeight(20000)).toBeUndefined();
    });
  });

  describe("toReps", () => {
    it("parses valid reps", () => {
      expect(toReps(10)).toBe(10);
      expect(toReps("8")).toBe(8);
    });
  });

  describe("toRir", () => {
    it("parses 0..10", () => {
      expect(toRir(0)).toBe(0);
      expect(toRir(2)).toBe(2);
      expect(toRir(10)).toBe(10);
    });
    it("returns undefined for out of range", () => {
      expect(toRir(-1)).toBeUndefined();
      expect(toRir(11)).toBeUndefined();
    });
  });
});
