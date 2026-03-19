/**
 * Import pipeline: file/rows -> detect layout -> parse (hierarchical or table) -> validate -> ImportProgram.
 * Supports Min-Max style (Week/Day blocks) and any Excel table with Exercise / Reps / Weight columns.
 */

import { readAllSheets } from "./readWorkbook";
import { classifyRows } from "./classifyRows";
import { buildProgram } from "./buildProgram";
import { validateImportProgram } from "./validateImport";
import { getText } from "./normalizeValues";
import { detectTableHeader } from "./detectLayout";
import { isDayLabel } from "./classifyRows";
import { parseTableToProgram } from "./parseTable";
import type { ImportProgram } from "./types";

export type { ImportProgram, ImportWeek, ImportDay, ImportExercise, ImportSet } from "./types";

export interface ParseOptions {
  programName?: string;
  fileName?: string;
}

/**
 * Parse sheet rows into ImportProgram. Tries multiple strategies:
 * 1. Hierarchical (Min-Max: Week N, day labels) - ALWAYS try first for Min-Max compatibility
 * 2. Table with header row (Exercise, Reps, Weight, etc.)
 * 3. Fallback: no header, assume columns 0=Exercise, 1=Reps, 2=Weight
 */
export function parseWorkbookToProgram(
  sheetRows: (string | number)[][],
  options?: ParseOptions
): ImportProgram {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const headerLike = /^(exercise|week|day|set|rep|weight|load|working|movement|name)$/i;
  function findProgramName(): string | null {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r] ?? [];
      for (let c = 0; c < Math.min(row.length, 5); c++) {
        const t = getText(row[c]).trim();
        if (t && t.length > 1 && !headerLike.test(t) && !/^week\s*\d+$/i.test(t) && !isDayLabel(t)) {
          return t;
        }
      }
    }
    return rows[0]?.[0] != null ? getText(rows[0][0]).trim() || null : null;
  }
  const programName =
    options?.programName ??
    findProgramName() ??
    "Imported Program";

  let program: ImportProgram;

  // Strategy 1: Always try hierarchical (Min-Max) first - it was the original working parser
  const classified = classifyRows(rows, { skipFirstRows: 0 });
  const hierarchicalProgram = buildProgram(rows, classified, programName);
  const hierarchicalValid =
    hierarchicalProgram.weeks.length > 0 &&
    hierarchicalProgram.weeks.some((w) => (w.days?.length ?? 0) > 0);

  if (hierarchicalValid) {
    program = hierarchicalProgram;
  } else {
    // Strategy 2 & 3: Fall back to table parser only if hierarchical produced nothing
    const columnMap = detectTableHeader(rows);
    if (columnMap) {
      program = parseTableToProgram({
        programName,
        columnMap,
        rows,
      });
    } else {
      const fallbackMap = {
        headerRowIndex: -1,
        roles: { exercise: 0, reps: 1, weight: 2 } as Partial<Record<"exercise" | "reps" | "weight", number>>,
      };
      program = parseTableToProgram({
        programName,
        columnMap: fallbackMap,
        rows,
      });
    }
  }

  const { valid, warnings } = validateImportProgram(program);
  if (!valid) {
    const msg =
      warnings.length > 0
        ? warnings.map((w) => w.message).join(" ")
        : "Parse failed: no program structure detected. Add a header row with at least 'Exercise' and 'Reps' or 'Weight', or use Week / Day labels.";
    throw new Error(msg);
  }

  return program;
}

/**
 * Parse from a file buffer (e.g. from FormData). Use this in the parse API.
 * Tries the first sheet, then each other sheet if the first fails to produce a valid program.
 */
export async function parseFromFile(
  buffer: ArrayBuffer,
  fileName: string,
  options?: { programName?: string }
): Promise<ImportProgram> {
  const { sheets } = await readAllSheets(buffer, fileName);
  if (sheets.length === 0) throw new Error("Workbook has no sheets");

  let lastError: Error | null = null;
  for (const { sheetName, rows } of sheets) {
    try {
      const program = parseWorkbookToProgram(rows, {
        ...options,
        fileName: `${fileName} (${sheetName})`,
      });
      if (program.weeks.length > 0 && program.weeks.some((w) => (w.days?.length ?? 0) > 0)) {
        return program;
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Parse failed: no sheet could be parsed as a program.");
}
