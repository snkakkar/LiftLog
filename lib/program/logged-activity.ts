export type ProgramDayLogShape = {
  sessions?: { loggedSets?: { id: string }[] }[];
};

export function dayHasLoggedActivity(day: ProgramDayLogShape): boolean {
  return (day.sessions ?? []).some((session) => (session.loggedSets ?? []).length > 0);
}
