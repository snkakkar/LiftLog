import { describe, it, expect } from "vitest";
import { safeExerciseName, repRangeLabel, isBodyweightExercise } from "../format";

describe("safeExerciseName", () => {
  it("returns string values unchanged", () => {
    expect(safeExerciseName("Bench Press")).toBe("Bench Press");
    expect(safeExerciseName("")).toBe("");
  });

  it("falls back to 'Exercise' for null/undefined", () => {
    expect(safeExerciseName(null)).toBe("Exercise");
    expect(safeExerciseName(undefined)).toBe("Exercise");
  });

  it("strips '[object X]' serializations and falls back to 'Exercise'", () => {
    expect(safeExerciseName({})).toBe("Exercise");
    expect(safeExerciseName([])).toBe("Exercise");
  });

  it("coerces numbers and other primitives to strings", () => {
    expect(safeExerciseName(42)).toBe("42");
    expect(safeExerciseName(true)).toBe("true");
  });
});

describe("repRangeLabel", () => {
  it("returns empty string when target is null or non-positive", () => {
    expect(repRangeLabel(null)).toBe("");
    expect(repRangeLabel(0)).toBe("");
    expect(repRangeLabel(-1)).toBe("");
  });

  it("returns single-rep label when min is missing", () => {
    expect(repRangeLabel(10)).toBe("10 reps");
    expect(repRangeLabel(10, null)).toBe("10 reps");
  });

  it("returns range label when min is below max", () => {
    expect(repRangeLabel(12, 8)).toBe("8–12 reps");
  });

  it("ignores min when it is not strictly below max", () => {
    expect(repRangeLabel(8, 8)).toBe("8 reps");
    expect(repRangeLabel(8, 12)).toBe("8 reps");
  });

  it("ignores min when it is below 1", () => {
    expect(repRangeLabel(10, 0)).toBe("10 reps");
    expect(repRangeLabel(10, -1)).toBe("10 reps");
  });
});

describe("isBodyweightExercise", () => {
  it("matches common bodyweight movements", () => {
    expect(isBodyweightExercise("Pull-up")).toBe(true);
    expect(isBodyweightExercise("Pull Up")).toBe(true);
    expect(isBodyweightExercise("pullup")).toBe(true);
    expect(isBodyweightExercise("Chin-Up")).toBe(true);
    expect(isBodyweightExercise("Push-Up")).toBe(true);
    expect(isBodyweightExercise("Muscle-Up")).toBe(true);
    expect(isBodyweightExercise("Dips")).toBe(true);
    expect(isBodyweightExercise("Ring Row")).toBe(true);
    expect(isBodyweightExercise("Inverted Row")).toBe(true);
  });

  it("does not match unrelated movements", () => {
    expect(isBodyweightExercise("Bench Press")).toBe(false);
    expect(isBodyweightExercise("Squat")).toBe(false);
    expect(isBodyweightExercise("Barbell Row")).toBe(false);
  });
});
