/**
 * V1 workbook parser: expects a specific Excel layout.
 * Layout: first sheet, row 1 = program name (optional), then header row with
 * Week | Day | Exercise | Sets. Data rows follow.
 * Alternative: first column = week, second = day, third = exercise, fourth = sets.
 * Isolated from canonical types; only produces ImportProgram.
 */

import type { ImportProgram, ImportWeek, ImportDay, ImportExercise } from "./types";
import { parseSetsString } from "./parse-sets";

const HEADERS = ["week", "day", "exercise", "sets"] as const;

function normalizeHeader(cell: string): string {
  return String(cell ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function findHeaderRow(sheet: string[][]): number {
  for (let r = 0; r < Math.min(sheet.length, 20); r++) {
    const row = sheet[r];
    if (!row) continue;
    const rowText = row.map((c) => normalizeHeader(String(c))).join(" ");
    if (
      HEADERS.every((h) =>
        rowText.includes(h)
      )
    ) {
      return r;
    }
  }
  return -1;
}

function getColumnIndexes(row: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let c = 0; c < row.length; c++) {
    const val = normalizeHeader(String(row[c] ?? ""));
    for (const h of HEADERS) {
      if (val === h || val.includes(h)) {
        idx[h] = c;
        break;
      }
    }
  }
  return idx;
}

/**
 * Parse first sheet of a 2D array (from xlsx) into ImportProgram.
 */
export function parseWorkbookV1(sheetRows: string[][]): ImportProgram {
  const programName =
    sheetRows[0]?.[0] != null && String(sheetRows[0][0]).trim()
      ? String(sheetRows[0][0]).trim()
      : "Imported Program";

  const headerRowIndex = findHeaderRow(sheetRows);
  if (headerRowIndex < 0) {
    return { name: programName, weeks: [] };
  }

  const headerRow = sheetRows[headerRowIndex] ?? [];
  const col = getColumnIndexes(headerRow);
  const weekCol = col.week ?? 0;
  const dayCol = col.day ?? 1;
  const exerciseCol = col.exercise ?? 2;
  const setsCol = col.sets ?? 3;

  const weekMap = new Map<number, ImportWeek>();

  for (let r = headerRowIndex + 1; r < sheetRows.length; r++) {
    const row = sheetRows[r] ?? [];
    const weekNum = parseInt(String(row[weekCol] ?? "1"), 10) || 1;
    const dayNum = parseInt(String(row[dayCol] ?? "1"), 10) || 1;
    const exerciseName = String(row[exerciseCol] ?? "").trim();
    const setsStr = String(row[setsCol] ?? "").trim();

    if (!exerciseName) continue;

    const sets = parseSetsString(setsStr);
    const exercise: ImportExercise = { name: exerciseName, sets: sets.length ? sets : [{ reps: undefined }] };

    let week = weekMap.get(weekNum);
    if (!week) {
      week = { weekNumber: weekNum, days: [] };
      weekMap.set(weekNum, week);
    }

    let day = week.days.find((d) => d.dayNumber === dayNum);
    if (!day) {
      day = { dayNumber: dayNum, name: undefined, exercises: [] };
      week.days.push(day);
    }

    day.exercises.push(exercise);
  }

  const weeks = Array.from(weekMap.values()).sort(
    (a, b) => a.weekNumber - b.weekNumber
  );

  return {
    name: programName,
    weeks,
  };
}
