/**
 * Canonical intermediate format for imported programs.
 * Parsers (workbook-specific) produce this; the app then maps it to the DB model.
 * Keeps workbook structure isolated from the app data model.
 */

export interface ImportSet {
  reps?: number;
  weight?: number;
  rir?: number;
  /** e.g. "8-10" for rep range */
  repRange?: string;
}

export interface ImportExercise {
  name: string;
  sets: ImportSet[];
  substitution1?: string;
  substitution2?: string;
}

export interface ImportDay {
  dayNumber: number;
  name?: string;
  exercises: ImportExercise[];
}

export interface ImportWeek {
  weekNumber: number;
  days: ImportDay[];
}

export interface ImportProgram {
  name: string;
  description?: string;
  weeks: ImportWeek[];
}
