import { describe, expect, it } from "vitest";
import { shouldForkExerciseIdentity } from "../rename-policy";

describe("shouldForkExerciseIdentity", () => {
  it("allows rename-by-fork when exercise has no logged sets", () => {
    expect(shouldForkExerciseIdentity(false)).toBe(true);
  });

  it("blocks rename-by-fork when exercise has logged sets", () => {
    expect(shouldForkExerciseIdentity(true)).toBe(false);
  });
});
