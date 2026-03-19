/**
 * Validation and warnings for parsed import data.
 * Does not silently fail—returns warnings that can be shown in the preview flow.
 */

import type { ImportProgram } from "./types";
import { weekHasLoggedData } from "./helpers";

export interface ParseWarning {
  type: string;
  message: string;
  rowIndex?: number;
  weekNumber?: number;
  dayNumber?: number;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ParseWarning[];
}

/**
 * Validate canonical ImportProgram. Returns valid: true if we have at least one week
 * and one day; warnings list issues without blocking import.
 */
export function validateImportProgram(program: ImportProgram): ValidationResult {
  const warnings: ParseWarning[] = [];

  if (!program.name || String(program.name).trim() === "") {
    warnings.push({ type: "missing_name", message: "Program name is empty; using default." });
  }

  if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
    return {
      valid: false,
      warnings: [...warnings, { type: "no_weeks", message: "No weeks found in the file." }],
    };
  }

  let totalDays = 0;
  let weeksWithNoDays = 0;
  let weeksWithNoLoggedData = 0;

  for (const w of program.weeks) {
    const dayCount = w.days?.length ?? 0;
    totalDays += dayCount;
    if (dayCount === 0) weeksWithNoDays++;
    if (!weekHasLoggedData(w)) weeksWithNoLoggedData++;
  }

  if (totalDays === 0) {
    return {
      valid: false,
      warnings: [
        ...warnings,
        { type: "no_days", message: "No workout days found. Check that the file has day labels (e.g. Full Body, Upper, Lower)." },
      ],
    };
  }

  if (weeksWithNoDays > 0) {
    warnings.push({
      type: "empty_weeks",
      message: `${weeksWithNoDays} week(s) have no workout days.`,
    });
  }

  if (weeksWithNoLoggedData === program.weeks.length && program.weeks.length > 0) {
    warnings.push({
      type: "no_logged_data",
      message: "No sets with reps/weight were found; program structure will be imported but no history will be logged.",
    });
  }

  return { valid: true, warnings };
}
