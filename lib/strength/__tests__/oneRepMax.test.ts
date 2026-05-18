import { describe, it, expect } from "vitest";
import { estimateOneRepMax, effectiveVolume, isWorkingSet } from "../oneRepMax";

describe("estimateOneRepMax", () => {
  it("returns null for missing data", () => {
    expect(estimateOneRepMax({ weight: null, reps: 5 })).toBeNull();
    expect(estimateOneRepMax({ weight: 100, reps: null })).toBeNull();
  });

  it("returns null for non-positive values", () => {
    expect(estimateOneRepMax({ weight: 0, reps: 5 })).toBeNull();
    expect(estimateOneRepMax({ weight: 100, reps: 0 })).toBeNull();
    expect(estimateOneRepMax({ weight: -10, reps: 5 })).toBeNull();
  });

  it("returns null for warmup sets", () => {
    expect(estimateOneRepMax({ weight: 135, reps: 10, isWarmup: true })).toBeNull();
  });

  it("returns null for form-deload sets", () => {
    expect(estimateOneRepMax({ weight: 135, reps: 10, isFormDeload: true })).toBeNull();
  });

  it("matches Epley when no RIR provided", () => {
    // 100 * (1 + 10/30) = 133.33...
    expect(estimateOneRepMax({ weight: 100, reps: 10 })).toBeCloseTo(133.3, 1);
  });

  it("uses effective reps = reps + rir", () => {
    // 100 * (1 + (8+2)/30) = 133.3 — same as 10 reps to failure
    const a = estimateOneRepMax({ weight: 100, reps: 8, rir: 2 });
    const b = estimateOneRepMax({ weight: 100, reps: 10, rir: 0 });
    expect(a).toBe(b);
  });

  it("treats negative RIR as 0", () => {
    expect(estimateOneRepMax({ weight: 100, reps: 10, rir: -5 })).toBeCloseTo(133.3, 1);
  });
});

describe("effectiveVolume", () => {
  it("returns 0 for warmups and form deloads", () => {
    expect(effectiveVolume({ weight: 100, reps: 10, isWarmup: true })).toBe(0);
    expect(effectiveVolume({ weight: 100, reps: 10, isFormDeload: true })).toBe(0);
  });

  it("computes weight × reps for working sets", () => {
    expect(effectiveVolume({ weight: 100, reps: 10 })).toBe(1000);
  });

  it("returns 0 for missing data", () => {
    expect(effectiveVolume({ weight: null, reps: 10 })).toBe(0);
    expect(effectiveVolume({ weight: 100, reps: null })).toBe(0);
  });
});

describe("isWorkingSet", () => {
  it("excludes warmup and form deload", () => {
    expect(isWorkingSet({ weight: 100, reps: 5, isWarmup: true })).toBe(false);
    expect(isWorkingSet({ weight: 100, reps: 5, isFormDeload: true })).toBe(false);
    expect(isWorkingSet({ weight: 100, reps: 5 })).toBe(true);
  });
});
