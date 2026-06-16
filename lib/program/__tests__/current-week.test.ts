import { describe, expect, it } from "vitest";
import { pickCurrentWeekId } from "../current-week";

describe("pickCurrentWeekId", () => {
  it("selects active week based on start-date windows", () => {
    const picked = pickCurrentWeekId(
      [
        { id: "w1", startDate: "2026-06-01" },
        { id: "w2", startDate: "2026-06-08" },
        { id: "w3", startDate: "2026-06-15" },
      ],
      new Date("2026-06-16T10:00:00")
    );
    expect(picked).toBe("w3");
  });

  it("falls back to latest started week when now is after all starts", () => {
    const picked = pickCurrentWeekId(
      [
        { id: "w1", startDate: "2026-06-01" },
        { id: "w2", startDate: "2026-06-08" },
      ],
      new Date("2026-07-01T10:00:00")
    );
    expect(picked).toBe("w2");
  });
});
