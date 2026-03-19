/**
 * Map canonical ImportProgram to Prisma entities and persist.
 * Keeps workbook parsing isolated from DB model.
 * Whole weeks with no logged data (no reps/weight/rir in any set) are not logged;
 * the most recently logged week is current date, then one week back per prior logged week.
 * Empty weeks are still created (week, days, exercises, template sets) so the user can
 * log them in the future without manually creating a week.
 */

import type { ImportProgram } from "./types";
import { weekHasLoggedData } from "./helpers";
import { prisma } from "@/lib/db";

export async function importProgramToDb(
  data: ImportProgram,
  userId: string
): Promise<string> {
  const program = await prisma.program.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
    },
  });

  // Among weeks with logged data, the one with the highest weekNumber is "current" (today).
  let maxLoggedWeekNumber = 0;
  for (let i = 0; i < data.weeks.length; i++) {
    if (weekHasLoggedData(data.weeks[i])) {
      const n = data.weeks[i].weekNumber;
      if (n > maxLoggedWeekNumber) maxLoggedWeekNumber = n;
    }
  }

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  for (let weekIdx = 0; weekIdx < data.weeks.length; weekIdx++) {
    const w = data.weeks[weekIdx];
    const week = await prisma.week.create({
      data: {
        programId: program.id,
        weekNumber: w.weekNumber,
      },
    });

    const shouldLogThisWeek = weekHasLoggedData(w);
    const weeksAgo =
      shouldLogThisWeek && maxLoggedWeekNumber >= w.weekNumber
        ? maxLoggedWeekNumber - w.weekNumber
        : 0;
    const sessionDate = shouldLogThisWeek
      ? new Date(Date.now() - weeksAgo * msPerWeek)
      : null;

    for (const d of w.days) {
      const day = await prisma.workoutDay.create({
        data: {
          weekId: week.id,
          dayNumber: d.dayNumber,
          name: d.name ?? null,
        },
      });

      let importSession: { id: string; startedAt: Date } | null = null;
      if (shouldLogThisWeek && sessionDate) {
        const session = await prisma.workoutSession.create({
          data: {
            workoutDayId: day.id,
            startedAt: sessionDate,
            completedAt: sessionDate,
          },
        });
        importSession = { id: session.id, startedAt: session.startedAt };
      }

      for (let exIdx = 0; exIdx < d.exercises.length; exIdx++) {
        const ex = d.exercises[exIdx];
        const exercise = await prisma.exercise.create({
          data: {
            workoutDayId: day.id,
            name: ex.name,
            orderIndex: exIdx,
            substitution1: ex.substitution1 ?? null,
            substitution2: ex.substitution2 ?? null,
          },
        });

        const setSpecs = ex.sets.length ? ex.sets : [{ reps: undefined }];
        for (let s = 0; s < setSpecs.length; s++) {
          const set = setSpecs[s];
          await prisma.exerciseSet.create({
            data: {
              exerciseId: exercise.id,
              setNumber: s + 1,
              targetReps: set.reps ?? null,
              targetWeight: set.weight ?? null,
              targetRir: set.rir ?? null,
            },
          });
          const hasLoggedData =
            set.reps != null || set.weight != null || set.rir != null;
          if (hasLoggedData && importSession) {
            await prisma.loggedSet.create({
              data: {
                workoutSessionId: importSession.id,
                exerciseId: exercise.id,
                setNumber: s + 1,
                reps: set.reps ?? null,
                weight: set.weight ?? null,
                rir: set.rir ?? null,
                isWarmup: false,
                completedAt: importSession.startedAt,
              },
            });
          }
        }
      }
    }
  }

  return program.id;
}
