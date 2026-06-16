import { describe, expect, it } from "vitest";
import { dayHasLoggedActivity } from "../logged-activity";

describe("dayHasLoggedActivity", () => {
  it("returns true when any session has logged sets", () => {
    expect(
      dayHasLoggedActivity({
        sessions: [
          { loggedSets: [] },
          { loggedSets: [{ id: "ls_1" }] },
        ],
      })
    ).toBe(true);
  });

  it("returns false when there are no logged sets", () => {
    expect(dayHasLoggedActivity({ sessions: [{ loggedSets: [] }] })).toBe(false);
    expect(dayHasLoggedActivity({ sessions: [] })).toBe(false);
    expect(dayHasLoggedActivity({})).toBe(false);
  });
});
