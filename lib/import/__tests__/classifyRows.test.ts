import { describe, it, expect } from "vitest";
import { classifyRow, classifyRows, isDayLabel } from "../classifyRows";

describe("classifyRows", () => {
  describe("isDayLabel", () => {
    it("recognizes day labels", () => {
      expect(isDayLabel("Full Body")).toBe(true);
      expect(isDayLabel("Upper")).toBe(true);
      expect(isDayLabel("Lower")).toBe(true);
      expect(isDayLabel("Arms/Delts")).toBe(true);
      expect(isDayLabel("upper body")).toBe(true);
    });
    it("rejects non-days", () => {
      expect(isDayLabel("Bench Press")).toBe(false);
      expect(isDayLabel("Week 1")).toBe(false);
      expect(isDayLabel("1-2 Rest Days")).toBe(false);
    });
  });

  describe("classifyRow", () => {
    it("classifies week header", () => {
      const r = classifyRow(["Week 1", ""], 0);
      expect(r.classification).toBe("week_header");
      expect(r.payload).toBe(1);
    });
    it("classifies day header", () => {
      expect(classifyRow(["Full Body", ""], 0).classification).toBe("day_header");
      expect(classifyRow(["", "Upper"], 0).classification).toBe("day_header");
    });
    it("classifies rest row", () => {
      expect(classifyRow(["1-2 Rest Days", ""], 0).classification).toBe("rest_row");
      expect(classifyRow(["Rest day", ""], 0).classification).toBe("rest_row");
    });
    it("classifies blank row", () => {
      expect(classifyRow([], 0).classification).toBe("blank");
      expect(classifyRow(["", "", ""], 0).classification).toBe("blank");
    });
    it("classifies exercise row", () => {
      const r = classifyRow(["", "Bench Press"], 5);
      expect(r.classification).toBe("exercise");
    });
  });

  describe("classifyRows", () => {
    it("returns one classification per row", () => {
      const rows = [
        ["Program Name"],
        ["Week 1", ""],
        ["Full Body", "Squat"],
      ];
      const result = classifyRows(rows);
      expect(result).toHaveLength(3);
      expect(result[0].classification).toBe("exercise");
      expect(result[1].classification).toBe("week_header");
      expect(result[2].classification).toBe("day_header");
    });
  });
});
