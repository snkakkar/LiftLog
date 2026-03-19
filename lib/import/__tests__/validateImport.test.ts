import { describe, it, expect } from "vitest";
import { validateImportProgram } from "../validateImport";
import type { ImportProgram } from "../types";

describe("validateImport", () => {
  it("valid when program has weeks and days", () => {
    const program: ImportProgram = {
      name: "Test",
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              dayNumber: 1,
              name: "Upper",
              exercises: [{ name: "Bench", sets: [{ reps: 8, weight: 95 }] }],
            },
          ],
        },
      ],
    };
    const r = validateImportProgram(program);
    expect(r.valid).toBe(true);
  });

  it("invalid when no weeks", () => {
    const program: ImportProgram = { name: "Test", weeks: [] };
    const r = validateImportProgram(program);
    expect(r.valid).toBe(false);
    expect(r.warnings.some((w) => w.type === "no_weeks")).toBe(true);
  });

  it("invalid when weeks have no days", () => {
    const program: ImportProgram = {
      name: "Test",
      weeks: [{ weekNumber: 1, days: [] }],
    };
    const r = validateImportProgram(program);
    expect(r.valid).toBe(false);
    expect(r.warnings.some((w) => w.type === "no_days")).toBe(true);
  });

  it("adds warning when no logged data", () => {
    const program: ImportProgram = {
      name: "Test",
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              dayNumber: 1,
              name: "Upper",
              exercises: [{ name: "Bench", sets: [{}] }],
            },
          ],
        },
      ],
    };
    const r = validateImportProgram(program);
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.type === "no_logged_data")).toBe(true);
  });
});
