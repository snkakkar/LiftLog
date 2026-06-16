import { describe, expect, it } from "vitest";
import { pickCurrentWeekId } from "../current-week";

describe("pickCurrentWeekId", () => {
  it("selects active week based on start-date windows", () => {
    const picked = pickCurrentWeekId(
      [
        { id: "w1", weekNumber: 1, startDate: "2026-06-01", hasLoggedActivity: false },
        { id: "w2", weekNumber: 2, startDate: "2026-06-08", hasLoggedActivity: false },
        { id: "w3", weekNumber: 3, startDate: "2026-06-15", hasLoggedActivity: false },
      ],
      new Date("2026-06-16T10:00:00")
    );
    expect(picked).toBe("w3");
  });

  it("falls back to latest started week when now is after all starts", () => {
    const picked = pickCurrentWeekId(
      [
        { id: "w1", weekNumber: 1, startDate: "2026-06-01", hasLoggedActivity: false },
        { id: "w2", weekNumber: 2, startDate: "2026-06-08", hasLoggedActivity: false },
      ],
      new Date("2026-07-01T10:00:00")
    );
    expect(picked).toBe("w2");
  });

  it("uses first unlogged week after last logged when all dates are missing", () => {
    const picked = pickCurrentWeekId([
      { id: "w1", weekNumber: 1, startDate: null, hasLoggedActivity: true },
      { id: "w2", weekNumber: 2, startDate: null, hasLoggedActivity: true },
      { id: "w3", weekNumber: 3, startDate: null, hasLoggedActivity: true },
      { id: "w4", weekNumber: 4, startDate: null, hasLoggedActivity: true },
      { id: "w5", weekNumber: 5, startDate: null, hasLoggedActivity: false },
    ]);
    expect(picked).toBe("w5");
  });

  it("falls back to last week when all weeks are logged and dates are missing", () => {
    const picked = pickCurrentWeekId([
      { id: "w1", weekNumber: 1, startDate: null, hasLoggedActivity: true },
      { id: "w2", weekNumber: 2, startDate: null, hasLoggedActivity: true },
    ]);
    expect(picked).toBe("w2");
  });

  it("defaults to week 1 when no logs and no dates", () => {
    const picked = pickCurrentWeekId([
      { id: "w1", weekNumber: 1, startDate: null, hasLoggedActivity: false },
      { id: "w2", weekNumber: 2, startDate: null, hasLoggedActivity: false },
    ]);
    expect(picked).toBe("w1");
  });
});
