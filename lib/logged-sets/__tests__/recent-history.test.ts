import { describe, expect, it } from "vitest";
import { selectRecentHistory, selectRecentWorkoutHistory } from "../recent-history";

describe("selectRecentHistory", () => {
  it("keeps older logs when they are the latest available history", () => {
    const result = selectRecentHistory([
      { reps: 8, weight: 135 },
      { reps: 7, weight: 130 },
      { reps: null, weight: null },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reps: 8, weight: 135 });
    expect(result[1]).toEqual({ reps: 7, weight: 130 });
  });

  it("drops empty rows and respects limit", () => {
    const result = selectRecentHistory(
      [
        { reps: null, weight: null },
        { reps: 5, weight: 225 },
        { reps: 6, weight: 220 },
      ],
      1
    );
    expect(result).toEqual([{ reps: 5, weight: 225 }]);
  });

  it("keeps sets from only the latest two workout sessions", () => {
    const result = selectRecentWorkoutHistory([
      { workoutSessionId: "s3", reps: 8, weight: 200 },
      { workoutSessionId: "s3", reps: 7, weight: 190 },
      { workoutSessionId: "s2", reps: 6, weight: 185 },
      { workoutSessionId: "s1", reps: 5, weight: 180 },
    ]);
    expect(result).toEqual([
      { workoutSessionId: "s3", reps: 8, weight: 200 },
      { workoutSessionId: "s3", reps: 7, weight: 190 },
      { workoutSessionId: "s2", reps: 6, weight: 185 },
    ]);
  });
});
