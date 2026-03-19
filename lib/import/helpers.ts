/**
 * Shared helpers for import pipeline and program creation.
 */

import type { ImportWeek } from "./types";

export function weekHasLoggedData(w: ImportWeek): boolean {
  for (const d of w.days) {
    for (const ex of d.exercises) {
      const setSpecs = ex.sets.length ? ex.sets : [{ reps: undefined }];
      for (const set of setSpecs) {
        if (set.reps != null || set.weight != null || set.rir != null) return true;
      }
    }
  }
  return false;
}
