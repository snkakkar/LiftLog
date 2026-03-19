/**
 * Row classifier: categorize each row as week header, day header, exercise, rest, blank, etc.
 * Uses known patterns for the Min-Max / Nippard-style workbook; structured for future expansion.
 */

import { getText } from "./normalizeValues";

export type RowClassification =
  | "week_header"
  | "day_header"
  | "exercise"
  | "table_header"
  | "rest_row"
  | "blank"
  | "info"
  | "uncertain";

export interface ClassifiedRow {
  rowIndex: number;
  classification: RowClassification;
  cells: (string | number)[];
  /** For week_header: week number. For day_header: day label. */
  payload?: number | string;
}

const WEEK_PATTERN = /^Week\s*(\d+)$/i;
const DAY_LABELS = new Set([
  "full body",
  "upper",
  "lower",
  "upper body",
  "lower body",
  "arms/delts",
  "arms",
  "delts",
]);
const REST_PREFIXES = [
  "block ",
  "intro week",
  "deload week",
  "1-2 rest",
  "2-3 rest",
  "rest day",
  "rest days",
];

function isBlankRow(cells: (string | number)[]): boolean {
  return cells.every((c) => {
    const t = getText(c);
    return t === "";
  });
}

function isWeekLabel(text: string): { week: number } | null {
  const m = text.match(WEEK_PATTERN);
  if (m) return { week: parseInt(m[1], 10) };
  return null;
}

export function isDayLabel(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  return DAY_LABELS.has(normalized);
}

function isRestRow(text: string): boolean {
  const lower = text.toLowerCase();
  return REST_PREFIXES.some((p) => lower.startsWith(p));
}

function isTableHeaderRow(cells: (string | number)[], rowIndex: number): boolean {
  if (rowIndex > 5) return false;
  const rowText = cells
    .slice(0, 8)
    .map((c) => getText(c))
    .join(" ")
    .toLowerCase();
  return (
    rowText.includes("exercise") ||
    rowText.includes("set") ||
    rowText.includes("rep") ||
    rowText.includes("working")
  );
}

/**
 * Classify a single row. Uses columns 0, 1, and 2 (A, B, C) for labels so that
 * files with an empty column A (data shifted right) still classify correctly.
 */
export function classifyRow(
  row: (string | number)[],
  rowIndex: number
): ClassifiedRow {
  const cells = Array.isArray(row) ? row : [];
  const a = getText(cells[0]);
  const b = getText(cells[1]);
  const c = getText(cells[2]);
  const primary = a || b || c;

  if (isBlankRow(cells)) {
    return { rowIndex, classification: "blank", cells };
  }

  const weekInfo = isWeekLabel(a) || isWeekLabel(b) || isWeekLabel(c);
  if (weekInfo) {
    return {
      rowIndex,
      classification: "week_header",
      cells,
      payload: weekInfo.week,
    };
  }

  if (primary && isRestRow(primary)) {
    return { rowIndex, classification: "rest_row", cells };
  }

  if (isDayLabel(a) || isDayLabel(b) || isDayLabel(c)) {
    const dayName = (a && isDayLabel(a) ? a : b && isDayLabel(b) ? b : c && isDayLabel(c) ? c : primary) as string;
    return {
      rowIndex,
      classification: "day_header",
      cells,
      payload: dayName,
    };
  }

  if (rowIndex < 15 && isTableHeaderRow(cells, rowIndex)) {
    return { rowIndex, classification: "table_header", cells };
  }

  if (primary && primary.length > 0) {
    return { rowIndex, classification: "exercise", cells };
  }

  return { rowIndex, classification: "uncertain", cells };
}

/**
 * Classify all rows. Optionally skip first N rows (e.g. title row).
 */
export function classifyRows(
  rows: (string | number)[][],
  options?: { skipFirstRows?: number }
): ClassifiedRow[] {
  const skip = options?.skipFirstRows ?? 0;
  const result: ClassifiedRow[] = [];
  for (let i = skip; i < rows.length; i++) {
    const row = rows[i] ?? [];
    result.push(classifyRow(row, i));
  }
  return result;
}
