/**
 * Centralized strength math.
 *
 * 1RM estimate uses Epley with an RIR adjustment.
 *   effectiveReps = reps + (rir ?? 0)
 *   1RM ≈ weight * (1 + effectiveReps / 30)
 *
 * Why: a set of 8 @ RIR 2 represents the same true strength as a set of 10 to failure.
 * Treating RIR as "reps left in the tank" and folding it into the rep count gives an
 * effort-normalized 1RM, so a user logging at RIR 2 isn't penalized vs. one logging to failure.
 *
 * Form-deload sets (intentional weight drop to clean up technique) are excluded from
 * 1RM and effective volume — they reflect skill work, not strength regression.
 * Warmups are likewise excluded.
 */

export interface SetForStrength {
  weight: number | null | undefined;
  reps: number | null | undefined;
  rir?: number | null | undefined;
  isWarmup?: boolean | null | undefined;
  isFormDeload?: boolean | null | undefined;
}

/**
 * Returns RIR-adjusted Epley 1RM, or null when the set should not contribute
 * to a strength estimate (warmup, form deload, missing data, non-positive values).
 */
export function estimateOneRepMax(set: SetForStrength): number | null {
  if (set.isWarmup) return null;
  if (set.isFormDeload) return null;
  const weight = set.weight;
  const reps = set.reps;
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  const rir = typeof set.rir === "number" && set.rir >= 0 ? set.rir : 0;
  const effectiveReps = reps + rir;
  if (effectiveReps <= 0) return null;
  const est = weight * (1 + effectiveReps / 30);
  return Math.round(est * 10) / 10;
}

/**
 * Effective load for volume calculations. Returns 0 for warmup or form-deload sets,
 * so they don't inflate weekly volume / volume-trend.
 */
export function effectiveVolume(set: SetForStrength): number {
  if (set.isWarmup) return 0;
  if (set.isFormDeload) return 0;
  const weight = set.weight;
  const reps = set.reps;
  if (weight == null || reps == null) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}

/** True if this set should be considered a "working" set for progression/strength logic. */
export function isWorkingSet(set: SetForStrength): boolean {
  return !set.isWarmup && !set.isFormDeload;
}
