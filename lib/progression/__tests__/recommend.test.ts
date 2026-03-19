import { describe, it, expect } from "vitest";
import { getProgressionSuggestion } from "../recommend";

describe("getProgressionSuggestion", () => {
  it("returns null suggestion when no logged sets", () => {
    const { suggestion } = getProgressionSuggestion(
      [{ targetReps: 8, targetWeight: 50, targetRir: 0 }],
      []
    );
    expect(suggestion).toBeNull();
  });

  it("returns null suggestion when last weight is missing", () => {
    const { suggestion } = getProgressionSuggestion(
      [{ targetReps: 8, targetWeight: 50, targetRir: 0 }],
      [{ reps: 8, weight: null, rir: 0 }]
    );
    expect(suggestion).toBeNull();
  });

  it("suggests increase when hitting top of rep range at target RIR", () => {
    const { suggestion } = getProgressionSuggestion(
      [{ targetReps: 8, targetWeight: 50, targetRir: 0 }],
      [{ reps: 8, weight: 50, rir: 0 }]
    );
    expect(suggestion).toContain("increase");
    expect(suggestion).toMatch(/52\.5|55/);
    expect(suggestion).toMatch(/reps/);
  });

  it("suggests stay or reduce when missing reps badly", () => {
    const { suggestion } = getProgressionSuggestion(
      [{ targetReps: 8, targetWeight: 50, targetRir: 0 }],
      [{ reps: 4, weight: 50, rir: 2 }]
    );
    expect(suggestion).toMatch(/Stay|reduce/);
  });

  it("does not suggest weight increase when reps below top of range", () => {
    const { suggestion } = getProgressionSuggestion(
      [{ targetReps: 10, targetWeight: 50, targetRir: 0 }],
      [{ reps: 8, weight: 50, rir: 0 }]
    );
    expect(suggestion).not.toContain("increase weight");
    expect(suggestion).toMatch(/beat last reps|8–10|10/);
  });
});
