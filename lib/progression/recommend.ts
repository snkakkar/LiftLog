/**
 * Simple progression recommendations from prior logs + prescription.
 * Weight is only increased when top of rep range is met/exceeded.
 */

export interface TemplateSet {
  targetReps: number | null;
  targetWeight: number | null;
  targetRir: number | null;
}

export interface LoggedSetRecord {
  reps: number | null;
  weight: number | null;
  rir: number | null;
  isWarmup?: boolean | null;
}

/** Rep range: targetReps is top; bottom is targetReps - 2 (min 1). */
export function getRepRangeFromTarget(targetReps: number | null): { low: number; high: number } | null {
  if (targetReps == null || targetReps < 1) return null;
  const high = targetReps;
  const low = Math.max(1, targetReps - 2);
  return { low, high };
}

export function repRangeLabel(targetReps: number | null): string {
  const range = getRepRangeFromTarget(targetReps);
  if (!range) return "";
  return range.low === range.high ? `${range.high} reps` : `${range.low}–${range.high} reps`;
}

/**
 * Suggest next action. Only recommends weight increase when top of rep range is met/exceeded.
 * Returns { suggestion, repRangeText }.
 */
export function getProgressionSuggestion(
  templateSets: TemplateSet[],
  lastLoggedSets: LoggedSetRecord[]
): { suggestion: string | null; repRangeText: string } {
  const templateWorking = templateSets.filter((_, i) => true);
  const targetReps = templateWorking[0]?.targetReps ?? 8;
  const repRangeText = repRangeLabel(targetReps);

  const working = lastLoggedSets.filter((s) => !s.isWarmup);
  if (working.length === 0) return { suggestion: null, repRangeText };

  if (templateWorking.length === 0) return { suggestion: null, repRangeText };

  const lastWeight = working[working.length - 1]?.weight;
  const lastReps = working[working.length - 1]?.reps;
  const targetWeight = templateWorking[0]?.targetWeight;
  const targetRir = templateWorking[0]?.targetRir ?? 0;
  const range = getRepRangeFromTarget(targetReps);
  const topOfRange = range?.high ?? targetReps;

  if (lastWeight == null) return { suggestion: null, repRangeText };

  // Only move weight up when top of rep range is met or exceeded for the given weight.
  const allHitTopOfRange = working.every((s) => s.reps != null && s.reps >= topOfRange);
  const anyMissedBad = working.some((s) => s.reps != null && s.reps < (range?.low ?? topOfRange - 2));
  const atOrUnderRir = targetRir >= 0 && working.every((s) => s.rir == null || s.rir <= targetRir + 1);

  if (allHitTopOfRange && atOrUnderRir && !anyMissedBad) {
    const inc = targetWeight != null ? 2.5 : 5;
    const suggestedWeight = Number((lastWeight + inc).toFixed(1));
    return {
      suggestion: `Suggested: ${suggestedWeight} lb × ${repRangeText} (increase weight when top of range met)`,
      repRangeText,
    };
  }
  if (anyMissedBad) {
    return {
      suggestion: `Stay at ${lastWeight} lb or reduce slightly; aim for ${repRangeText}`,
      repRangeText,
    };
  }
  if (lastReps != null && lastReps < topOfRange) {
    return {
      suggestion: `Suggested: ${lastWeight} lb × ${repRangeText} — beat last reps (${lastReps} → ${topOfRange}) before adding weight`,
      repRangeText,
    };
  }
  return { suggestion: null, repRangeText };
}
