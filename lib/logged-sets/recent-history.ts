export type LoggedSetHistoryLike = {
  reps: number | null;
  weight: number | null;
};

export function selectRecentHistory<T extends LoggedSetHistoryLike>(sets: T[], limit = 20): T[] {
  return sets
    .filter((s) => (s.reps != null && s.reps > 0) || s.weight != null)
    .slice(0, limit);
}
