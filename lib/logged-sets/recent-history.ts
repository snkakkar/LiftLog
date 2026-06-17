export type LoggedSetHistoryLike = {
  reps: number | null;
  weight: number | null;
};

export function selectRecentHistory<T extends LoggedSetHistoryLike>(sets: T[], limit = 20): T[] {
  return sets
    .filter((s) => (s.reps != null && s.reps > 0) || s.weight != null)
    .slice(0, limit);
}

export type LoggedSetWorkoutLike = LoggedSetHistoryLike & {
  workoutSessionId: string;
};

/** Keep sets from the N most recent workout sessions (input expected newest-first). */
export function selectRecentWorkoutHistory<T extends LoggedSetWorkoutLike>(
  sets: T[],
  workoutLimit = 2
): T[] {
  const filtered = selectRecentHistory(sets, Number.POSITIVE_INFINITY);
  const keepSessionIds = new Set<string>();
  for (const set of filtered) {
    if (keepSessionIds.has(set.workoutSessionId)) continue;
    keepSessionIds.add(set.workoutSessionId);
    if (keepSessionIds.size >= workoutLimit) break;
  }
  return filtered.filter((s) => keepSessionIds.has(s.workoutSessionId));
}
