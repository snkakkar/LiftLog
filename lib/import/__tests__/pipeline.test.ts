import { describe, it, expect } from "vitest";
import { parseWorkbookToProgram } from "../pipeline";

describe("pipeline", () => {
  it("parses minimal Min-Max style sheet: Week 1, one day, one exercise", () => {
    const rows: (string | number)[][] = [
      ["Min-Max Program"],
      ["Week 1", ""],
      ["Full Body", "Squat", "", "", 3, "", 135, 8, "", 10, "", 12, 0],
      ["", "Bench Press", "", "", 2, "", 95, 10],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.name).toBe("Min-Max Program");
    expect(program.weeks).toHaveLength(1);
    expect(program.weeks[0].weekNumber).toBe(1);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].name).toBe("Full Body");
    expect(program.weeks[0].days[0].exercises).toHaveLength(2);
    expect(program.weeks[0].days[0].exercises[0].name).toBe("Squat");
    expect(program.weeks[0].days[0].exercises[0].sets.length).toBeGreaterThanOrEqual(1);
    expect(program.weeks[0].days[0].exercises[1].name).toBe("Bench Press");
  });

  it("ignores rest rows", () => {
    const rows: (string | number)[][] = [
      ["Week 1", ""],
      ["1-2 Rest Days", ""],
      ["Full Body", "Squat", "", "", 2, "", 100, 10],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.weeks).toHaveLength(1);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].exercises).toHaveLength(1);
  });

  it("throws when no weeks found", () => {
    const rows: (string | number)[][] = [
      ["Just a title"],
      ["Some text", "More text"],
    ];
    expect(() => parseWorkbookToProgram(rows)).toThrow(/no weeks|no program structure/i);
  });

  it("throws when no workout days found", () => {
    const rows: (string | number)[][] = [
      ["Week 1", ""],
      ["", ""],
    ];
    expect(() => parseWorkbookToProgram(rows)).toThrow(/no weeks|no workout days|no program structure/i);
  });

  it("parses shifted layout (empty col A: week/day in B, exercise in C, working sets col 5, load/reps 7/8)", () => {
    const rows: (string | number)[][] = [
      ["", "Program"],
      ["", "Week 1", ""],
      ["", "Full Body", "Lying Leg Curl", "", 0, 2, 0, 135, 6, 135, 7, "", "", 1, 0],
      ["", "", "Squat", "", 0, 2, 0, 95, 10],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.weeks).toHaveLength(1);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].name).toBe("Full Body");
    expect(program.weeks[0].days[0].exercises).toHaveLength(2);
    expect(program.weeks[0].days[0].exercises[0].name).toBe("Lying Leg Curl");
    expect(program.weeks[0].days[0].exercises[0].sets[0]).toMatchObject({ weight: 135, reps: 6 });
    expect(program.weeks[0].days[0].exercises[1].name).toBe("Squat");
    expect(program.weeks[0].days[0].exercises[1].sets[0]).toMatchObject({ weight: 95, reps: 10 });
  });

  it("parses table layout with Exercise, Reps, Weight header", () => {
    const rows: (string | number)[][] = [
      ["Program Name"],
      ["Exercise", "Reps", "Weight"],
      ["Bench Press", 8, 135],
      ["Squat", 10, 185],
      ["Deadlift", 5, 225],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.name).toBe("Program Name");
    expect(program.weeks).toHaveLength(1);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].exercises).toHaveLength(3);
    expect(program.weeks[0].days[0].exercises[0].name).toBe("Bench Press");
    expect(program.weeks[0].days[0].exercises[0].sets).toContainEqual({ reps: 8, weight: 135 });
    expect(program.weeks[0].days[0].exercises[1].name).toBe("Squat");
    expect(program.weeks[0].days[0].exercises[2].name).toBe("Deadlift");
  });

  it("parses table with Week and Day columns", () => {
    const rows: (string | number)[][] = [
      ["Week", "Day", "Exercise", "Reps", "Weight"],
      [1, "Upper", "Bench Press", 8, 95],
      [1, "Upper", "Row", 10, 65],
      [2, "Lower", "Squat", 6, 135],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.weeks).toHaveLength(2);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].name).toBe("Upper");
    expect(program.weeks[0].days[0].exercises).toHaveLength(2);
    expect(program.weeks[1].days[0].name).toBe("Lower");
    expect(program.weeks[1].days[0].exercises[0].name).toBe("Squat");
  });

  it("parses multiple weeks and days", () => {
    const rows: (string | number)[][] = [
      ["Program"],
      ["Week 1", ""],
      ["Upper", "Bench"],
      ["", "", "", "", 3, "", 95, 8],
      ["Week 2", ""],
      ["Lower", "Squat"],
      ["", "", "", "", 3, "", 135, 6],
    ];
    const program = parseWorkbookToProgram(rows);
    expect(program.weeks).toHaveLength(2);
    expect(program.weeks[0].weekNumber).toBe(1);
    expect(program.weeks[0].days).toHaveLength(1);
    expect(program.weeks[0].days[0].name).toBe("Upper");
    expect(program.weeks[1].weekNumber).toBe(2);
    expect(program.weeks[1].days[0].name).toBe("Lower");
  });
});
