export type ProgramWeekLite = {
  id: string;
  startDate: string | null;
};

export function pickCurrentWeekId(weeks: ProgramWeekLite[], now: Date = new Date()): string | null {
  if (weeks.length === 0) return null;
  const sorted = [...weeks]
    .filter((w) => !!w.startDate)
    .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime());
  if (sorted.length === 0) return weeks[0]?.id ?? null;

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const nowMs = today.getTime();

  for (let i = 0; i < sorted.length; i++) {
    const start = new Date(`${sorted[i].startDate}T12:00:00`).getTime();
    const nextStart = i + 1 < sorted.length ? new Date(`${sorted[i + 1].startDate}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
    if (nowMs >= start && nowMs < nextStart) {
      return sorted[i].id;
    }
  }

  const startedWeeks = sorted.filter((w) => new Date(`${w.startDate}T12:00:00`).getTime() <= nowMs);
  if (startedWeeks.length > 0) return startedWeeks[startedWeeks.length - 1].id;
  return sorted[0].id;
}
