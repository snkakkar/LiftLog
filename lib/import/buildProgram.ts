/**
 * Build ImportProgram from raw rows and classified rows.
 * Supports two column layouts:
 * - Standard: Week/Day in A/B, Exercise in A/B, Working Sets col 4, Set 1 Load/Reps 6/7, RIR 12+, Sub 15/16.
 * - Shifted (empty col A): Week/Day in B, Exercise in B or C, Working Sets col 5, Load/Reps 7/8, RIR 13+, Sub 16/17.
 */

import type { ImportProgram, ImportWeek, ImportDay, ImportExercise, ImportSet } from "./types";
import type { ClassifiedRow } from "./classifyRows";
import {
  getText,
  toWorkingSetCount,
  toWeight,
  toReps,
  toRir,
} from "./normalizeValues";
import { isDayLabel } from "./classifyRows";

/** Detect column offset: 0 = data in A, 1 = data shifted right (empty A). Uses load/reps sanity so Excel date serials are not treated as data. */
function detectOffset(row: (string | number)[]): 0 | 1 {
  const w4 = toWorkingSetCount(row[4]);
  const w5 = toWorkingSetCount(row[5]);
  const load6 = toWeight(row[6]);
  const reps7 = toReps(row[7]);
  const load7 = toWeight(row[7]);
  const reps8 = toReps(row[8]);
  const looksLikeDataAt4 = w4 >= 1 && w4 <= 20 && load6 != null && load6 < 2000 && reps7 != null && reps7 <= 100;
  const looksLikeDataAt5 = w5 >= 1 && w5 <= 20 && load7 != null && load7 < 2000 && reps8 != null && reps8 <= 100;
  if (looksLikeDataAt5 && !looksLikeDataAt4) return 1;
  return 0;
}

function getSetDataFromRow(row: (string | number)[], workingSetCount: number, offset: 0 | 1): ImportSet[] {
  const sets: ImportSet[] = [];
  const count = Math.max(workingSetCount || 1, 1);
  const loadBase = 6 + offset;
  const repsBase = 7 + offset;
  const rirBase = 12 + offset;
  for (let s = 0; s < count; s++) {
    const loadCol = loadBase + s * 2;
    const repsCol = repsBase + s * 2;
    const rirCol = rirBase + s;
    let weight = toWeight(row[loadCol]);
    let reps = toReps(row[repsCol]);
    if (weight === undefined && reps === undefined) {
      weight = toWeight(row[loadCol - 1]);
      reps = toReps(row[repsCol - 1]);
    }
    const rir = toRir(row[rirCol]);
    if (weight !== undefined || reps !== undefined || rir !== undefined) {
      sets.push({ reps: reps ?? undefined, weight, rir: rir ?? undefined });
    } else {
      sets.push({});
    }
  }
  if (sets.length === 0) sets.push({});
  return sets;
}

function getSubstitutions(row: (string | number)[], offset: 0 | 1): { substitution1?: string; substitution2?: string } {
  const s1Col = 15 + offset;
  const s2Col = 16 + offset;
  const s1 = getText(row[s1Col]).trim();
  const s2 = getText(row[s2Col]).trim();
  return {
    ...(s1 ? { substitution1: s1 } : {}),
    ...(s2 ? { substitution2: s2 } : {}),
  };
}

function getExerciseName(row: (string | number)[]): string {
  const a = getText(row[0]);
  const b = getText(row[1]);
  const c = getText(row[2]);
  return b || a || c;
}

function getExerciseNameFromDayRow(cells: (string | number)[], _dayLabel: string): string | null {
  const a = getText(cells[0]);
  const b = getText(cells[1]);
  const c = getText(cells[2]);
  const fromA = a && !isDayLabel(a) ? a : null;
  const fromB = b && !isDayLabel(b) ? b : null;
  const fromC = c && !isDayLabel(c) ? c : null;
  const name = fromB || fromA || fromC;
  return name && name.length > 0 ? name : null;
}

/**
 * Build ImportProgram from raw rows and classified rows.
 * Assumes classified rows align with raw rows by rowIndex.
 */
export function buildProgram(
  rawRows: (string | number)[][],
  classified: ClassifiedRow[],
  programName: string
): ImportProgram {
  const weeks: ImportWeek[] = [];
  let currentWeek: ImportWeek | null = null;
  let currentDay: ImportDay | null = null;
  let dayNumber = 0;
  let offset: 0 | 1 | null = null;

  for (const cr of classified) {
    const row = rawRows[cr.rowIndex] ?? [];

    switch (cr.classification) {
      case "week_header": {
        const weekNum = typeof cr.payload === "number" ? cr.payload : 1;
        currentWeek = { weekNumber: weekNum, days: [] };
        weeks.push(currentWeek);
        dayNumber = 0;
        currentDay = null;
        break;
      }

      case "day_header": {
        if (!currentWeek) break;
        dayNumber += 1;
        const dayName = (typeof cr.payload === "string" ? cr.payload : getText(row[0]) || getText(row[1]) || getText(row[2]) || `Day ${dayNumber}`) as string;
        currentDay = {
          dayNumber,
          name: dayName,
          exercises: [],
        };
        currentWeek.days.push(currentDay);
        const firstExName = getExerciseNameFromDayRow(row, dayName);
        if (firstExName) {
          if (offset === null) offset = detectOffset(row);
          const workCol = 4 + (offset ?? 0);
          const workingSetsNum = toWorkingSetCount(row[workCol]);
          const sets = getSetDataFromRow(row, workingSetsNum, offset ?? 0);
          const ex: ImportExercise = {
            name: firstExName,
            sets,
            ...getSubstitutions(row, offset ?? 0),
          };
          currentDay.exercises.push(ex);
        }
        break;
      }

      case "exercise": {
        if (!currentDay) break;
        const exName = getExerciseName(row);
        if (!exName) break;
        if (offset === null) offset = detectOffset(row);
        const workCol = 4 + (offset ?? 0);
        const workingSetsNum = toWorkingSetCount(row[workCol]);
        const sets = getSetDataFromRow(row, workingSetsNum, offset ?? 0);
        const ex: ImportExercise = {
          name: exName,
          sets,
          ...getSubstitutions(row, offset ?? 0),
        };
        currentDay.exercises.push(ex);
        break;
      }

      case "blank":
      case "rest_row":
      case "table_header":
      case "info":
      case "uncertain":
        break;
    }
  }

  return {
    name: programName,
    weeks,
  };
}
