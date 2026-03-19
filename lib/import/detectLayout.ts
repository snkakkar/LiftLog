/**
 * Detect sheet layout: hierarchical (Week/Day blocks) vs table with header row.
 * Returns column mapping for table layout or null to use hierarchical parser.
 */

import { getText } from "./normalizeValues";

export type ColumnRole =
  | "exercise"
  | "reps"
  | "weight"
  | "sets"   // total set count
  | "rir"
  | "rpe"
  | "week"
  | "day"
  | "set_number"; // 1-based set index column

export interface ColumnMap {
  headerRowIndex: number;
  roles: Partial<Record<ColumnRole, number>>;
  /** For "Set 1 Reps", "Set 1 Weight" style: column index -> set index (0-based) and type */
  setColumns?: { colIndex: number; setIndex: number; type: "reps" | "weight" }[];
}

const EXERCISE_HEADERS = ["exercise", "movement", "name", "exercise name", "lift", "workout"];
const REPS_HEADERS = ["reps", "rep", "repetitions", "r"];
const WEIGHT_HEADERS = ["weight", "load", "lb", "lbs", "kg", "kgs"];
const SETS_HEADERS = ["sets", "set", "# sets"];
const RIR_HEADERS = ["rir", "reps in reserve"];
const RPE_HEADERS = ["rpe", "rpe (1-10)"];
const WEEK_HEADERS = ["week", "wk", "weeks"];
const DAY_HEADERS = ["day", "day name", "workout day"];
const SET_NUM_HEADERS = ["set #", "set number", "set no", "#"];

function normalizeHeader(cell: string | number): string {
  return getText(cell).toLowerCase().replace(/\s+/g, " ").trim();
}

function cellMatches(cell: string, keywords: string[]): boolean {
  const n = normalizeHeader(cell);
  return keywords.some((k) => n === k || n.includes(k) || n.startsWith(k + " "));
}

/** Match "Set 1", "Set 2 Reps", "Set 1 Weight", etc. */
function matchSetColumn(cell: string): { setIndex: number; type: "reps" | "weight" } | null {
  const n = normalizeHeader(cell);
  const setMatch = n.match(/set\s*(\d+)/);
  if (!setMatch) return null;
  const setIndex = parseInt(setMatch[1], 10) - 1;
  if (n.includes("rep")) return { setIndex, type: "reps" };
  if (n.includes("weight") || n.includes("load") || n.includes("lb") || n.includes("kg")) return { setIndex, type: "weight" };
  if (setIndex >= 0) return { setIndex, type: "reps" };
  return null;
}

/**
 * Find the first row that looks like a header (contains at least "exercise" or "movement"
 * and one of reps/weight/set). Returns column map or null.
 */
export function detectTableHeader(rows: (string | number)[][]): ColumnMap | null {
  const maxCols = Math.max(0, ...rows.slice(0, 20).map((r) => r.length));
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] ?? [];
    const roles: Partial<Record<ColumnRole, number>> = {};
    const setColumns: { colIndex: number; setIndex: number; type: "reps" | "weight" }[] = [];

    for (let c = 0; c < Math.min(row.length, maxCols + 5); c++) {
      const cell = getText(row[c]);
      if (!cell) continue;

      if (roles.exercise === undefined && cellMatches(cell, EXERCISE_HEADERS)) {
        roles.exercise = c;
        continue;
      }
      if (roles.reps === undefined && cellMatches(cell, REPS_HEADERS) && !matchSetColumn(cell)) {
        roles.reps = c;
        continue;
      }
      if (roles.weight === undefined && cellMatches(cell, WEIGHT_HEADERS) && !matchSetColumn(cell)) {
        roles.weight = c;
        continue;
      }
      if (roles.sets === undefined && cellMatches(cell, SETS_HEADERS)) {
        roles.sets = c;
        continue;
      }
      if (roles.rir === undefined && cellMatches(cell, RIR_HEADERS)) {
        roles.rir = c;
        continue;
      }
      if (roles.rpe === undefined && cellMatches(cell, RPE_HEADERS)) {
        roles.rpe = c;
        continue;
      }
      if (roles.week === undefined && cellMatches(cell, WEEK_HEADERS)) {
        roles.week = c;
        continue;
      }
      if (roles.day === undefined && cellMatches(cell, DAY_HEADERS)) {
        roles.day = c;
        continue;
      }
      if (roles.set_number === undefined && cellMatches(cell, SET_NUM_HEADERS)) {
        roles.set_number = c;
        continue;
      }

      const setInfo = matchSetColumn(cell);
      if (setInfo) {
        setColumns.push({ colIndex: c, setIndex: setInfo.setIndex, type: setInfo.type });
      }
    }

    const hasExercise = roles.exercise !== undefined;
    const hasDataColumn =
      roles.reps !== undefined ||
      roles.weight !== undefined ||
      roles.sets !== undefined ||
      setColumns.length > 0;
    if (hasExercise && hasDataColumn) {
      setColumns.sort((a, b) => a.setIndex - b.setIndex || (a.type === "reps" ? -1 : 1));
      return {
        headerRowIndex: r,
        roles,
        setColumns: setColumns.length > 0 ? setColumns : undefined,
      };
    }
  }
  return null;
}

/**
 * Quick check: does the sheet look like hierarchical (Week N, day labels)?
 * If true, we use the existing Min-Max style parser.
 */
export function looksHierarchical(rows: (string | number)[][]): boolean {
  const sample = rows.slice(0, 50);
  let seenWeek = false;
  let seenDay = false;
  const dayLabels = new Set([
    "full body", "upper", "lower", "upper body", "lower body",
    "arms", "delts", "arms/delts", "push", "pull", "legs",
  ]);
  for (const row of sample) {
    const a = getText(row[0]);
    const b = getText(row[1] ?? "");
    const c = getText(row[2] ?? "");
    const first = a || b || c;
    if (/^week\s*\d+$/i.test(first)) seenWeek = true;
    if (dayLabels.has(first.toLowerCase()) || dayLabels.has(b.toLowerCase()) || dayLabels.has(c.toLowerCase())) {
      seenDay = true;
    }
    if (seenWeek && seenDay) return true;
  }
  return seenWeek && seenDay;
}
