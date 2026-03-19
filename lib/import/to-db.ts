/**
 * Map canonical ImportProgram to Prisma entities and persist.
 * Uses bulk operations (createMany, createManyAndReturn) to minimize DB round-trips.
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

  let maxLoggedWeekNumber = 0;
  for (const w of data.weeks) {
    if (weekHasLoggedData(w) && w.weekNumber > maxLoggedWeekNumber) {
      maxLoggedWeekNumber = w.weekNumber;
    }
  }
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  // 1. Create all weeks in one batch
  const weeks = await prisma.week.createManyAndReturn({
    data: data.weeks.map((w) => ({
      programId: program.id,
      weekNumber: w.weekNumber,
    })),
  });
  const weekByNumber = new Map(weeks.map((w) => [w.weekNumber, w]));

  // 2. Create all days in one batch
  const daysData: { weekId: string; dayNumber: number; name: string | null }[] = [];
  const dayMeta: { weekIdx: number; dayData: (typeof data.weeks)[0]["days"][0] }[] = [];
  for (let wi = 0; wi < data.weeks.length; wi++) {
    const w = data.weeks[wi];
    const week = weekByNumber.get(w.weekNumber);
    if (!week) continue;
    for (const d of w.days) {
      daysData.push({
        weekId: week.id,
        dayNumber: d.dayNumber,
        name: d.name ?? null,
      });
      dayMeta.push({ weekIdx: wi, dayData: d });
    }
  }
  const days = await prisma.workoutDay.createManyAndReturn({ data: daysData });

  // 3. Create all sessions in one batch (only for days in weeks with logged data)
  const sessionsData: {
    workoutDayId: string;
    startedAt: Date;
    completedAt: Date;
  }[] = [];
  const sessionDayIndices: number[] = [];
  for (let di = 0; di < days.length; di++) {
    const { weekIdx, dayData } = dayMeta[di];
    const w = data.weeks[weekIdx];
    if (!weekHasLoggedData(w)) continue;
    const weeksAgo = maxLoggedWeekNumber - w.weekNumber;
    const sessionDate = new Date(Date.now() - weeksAgo * msPerWeek);
    sessionsData.push({
      workoutDayId: days[di].id,
      startedAt: sessionDate,
      completedAt: sessionDate,
    });
    sessionDayIndices.push(di);
  }
  const sessions =
    sessionsData.length > 0
      ? await prisma.workoutSession.createManyAndReturn({ data: sessionsData })
      : [];
  const sessionByDayIndex = new Map(
    sessionDayIndices.map((di, i) => [di, sessions[i]])
  );

  // 4. Create all exercises in one batch
  const exercisesData: {
    workoutDayId: string;
    name: string;
    orderIndex: number;
    substitution1: string | null;
    substitution2: string | null;
  }[] = [];
  const exerciseMeta: { setSpecs: { reps?: number; weight?: number; rir?: number }[]; dayIndex: number }[] = [];
  for (let di = 0; di < days.length; di++) {
    const { dayData } = dayMeta[di];
    for (let exIdx = 0; exIdx < dayData.exercises.length; exIdx++) {
      const ex = dayData.exercises[exIdx];
      const setSpecs = ex.sets.length ? ex.sets : [{ reps: undefined }];
      exercisesData.push({
        workoutDayId: days[di].id,
        name: ex.name,
        orderIndex: exIdx,
        substitution1: ex.substitution1 ?? null,
        substitution2: ex.substitution2 ?? null,
      });
      exerciseMeta.push({ setSpecs, dayIndex: di });
    }
  }
  const exercises =
    exercisesData.length > 0
      ? await prisma.exercise.createManyAndReturn({ data: exercisesData })
      : [];

  // 5. Create all exercise sets in one batch
  const setsData: {
    exerciseId: string;
    setNumber: number;
    targetReps: number | null;
    targetWeight: number | null;
    targetRir: number | null;
  }[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const { setSpecs } = exerciseMeta[i];
    for (let s = 0; s < setSpecs.length; s++) {
      const set = setSpecs[s];
      setsData.push({
        exerciseId: exercises[i].id,
        setNumber: s + 1,
        targetReps: set.reps ?? null,
        targetWeight: set.weight ?? null,
        targetRir: set.rir ?? null,
      });
    }
  }
  if (setsData.length > 0) {
    await prisma.exerciseSet.createMany({ data: setsData });
  }

  // 6. Create all logged sets in one batch
  const loggedData: {
    workoutSessionId: string;
    exerciseId: string;
    setNumber: number;
    reps: number | null;
    weight: number | null;
    rir: number | null;
    isWarmup: boolean;
    completedAt: Date;
  }[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const session = sessionByDayIndex.get(exerciseMeta[i].dayIndex);
    if (!session) continue;
    const { setSpecs } = exerciseMeta[i];
    for (let s = 0; s < setSpecs.length; s++) {
      const set = setSpecs[s];
      if (set.reps == null && set.weight == null && set.rir == null) continue;
      loggedData.push({
        workoutSessionId: session.id,
        exerciseId: exercises[i].id,
        setNumber: s + 1,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        rir: set.rir ?? null,
        isWarmup: false,
        completedAt: session.startedAt,
      });
    }
  }
  if (loggedData.length > 0) {
    await prisma.loggedSet.createMany({ data: loggedData });
  }

  return program.id;
}
