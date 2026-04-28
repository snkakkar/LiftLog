import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * POST - Propagate changes on this day to the same dayNumber in all subsequent weeks.
 *
 * Body options:
 *   { exerciseId?: string }
 *     — propagates template sets for that exercise (or all exercises if omitted).
 *   { supersetGroupId: string }
 *     — propagates a superset pairing: finds the two exercises sharing this groupId on
 *       the source day, then pairs matching exercises (by name) on each target day.
 *   { removeSupersetExerciseId: string }
 *     — clears the supersetGroupId for the matching exercise (and its partner) on each
 *       target day.
 *
 * Always skips target days that already have logged sets.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: workoutDayId } = await params;

  const sourceDay = await prisma.workoutDay.findFirst({
    where: { id: workoutDayId, week: { program: { userId } } },
    include: {
      week: true,
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: { templateSets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  if (!sourceDay) return NextResponse.json({ error: "Workout day not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Find all subsequent weeks in the same program (higher weekNumber)
  const subsequentWeeks = await prisma.week.findMany({
    where: {
      programId: sourceDay.week.programId,
      weekNumber: { gt: sourceDay.week.weekNumber },
    },
    orderBy: { weekNumber: "asc" },
    include: {
      days: {
        where: { dayNumber: sourceDay.dayNumber },
        include: {
          exercises: {
            orderBy: { orderIndex: "asc" },
            include: { templateSets: { orderBy: { setNumber: "asc" } } },
          },
          sessions: { include: { loggedSets: { take: 1 } } },
        },
      },
    },
  });

  let updatedWeeks = 0;

  // --- Superset pairing propagation ---
  if (typeof body.supersetGroupId === "string") {
    const gid = body.supersetGroupId;
    const paired = sourceDay.exercises.filter((e) => e.supersetGroupId === gid);
    if (paired.length !== 2) {
      return NextResponse.json({ error: "Superset pair not found on source day" }, { status: 404 });
    }
    const [srcA, srcB] = paired;

    for (const week of subsequentWeeks) {
      const targetDay = week.days[0];
      if (!targetDay) continue;
      const hasLogs = targetDay.sessions.some((s) => s.loggedSets.length > 0);
      if (hasLogs) continue;

      const tgtA = targetDay.exercises.find(
        (e) => e.name.toLowerCase() === srcA.name.toLowerCase()
      );
      const tgtB = targetDay.exercises.find(
        (e) => e.name.toLowerCase() === srcB.name.toLowerCase()
      );
      if (!tgtA || !tgtB) continue;

      // Clear any existing superset memberships for these two exercises
      const groupsToClear = new Set(
        [tgtA.supersetGroupId, tgtB.supersetGroupId].filter((g): g is string => Boolean(g))
      );
      for (const oldGid of groupsToClear) {
        await prisma.exercise.updateMany({
          where: { workoutDayId: targetDay.id, supersetGroupId: oldGid },
          data: { supersetGroupId: null },
        });
      }

      const newGroupId = randomUUID();
      await prisma.exercise.update({ where: { id: tgtA.id }, data: { supersetGroupId: newGroupId } });
      await prisma.exercise.update({ where: { id: tgtB.id }, data: { supersetGroupId: newGroupId } });
      updatedWeeks++;
    }

    return NextResponse.json({ ok: true, updatedWeeks });
  }

  // --- Remove superset propagation ---
  if (typeof body.removeSupersetExerciseId === "string") {
    const srcEx = sourceDay.exercises.find((e) => e.id === body.removeSupersetExerciseId);
    if (!srcEx) return NextResponse.json({ error: "Exercise not found on source day" }, { status: 404 });

    for (const week of subsequentWeeks) {
      const targetDay = week.days[0];
      if (!targetDay) continue;
      const hasLogs = targetDay.sessions.some((s) => s.loggedSets.length > 0);
      if (hasLogs) continue;

      const tgtEx = targetDay.exercises.find(
        (e) => e.name.toLowerCase() === srcEx.name.toLowerCase()
      );
      if (!tgtEx?.supersetGroupId) continue;

      await prisma.exercise.updateMany({
        where: { workoutDayId: targetDay.id, supersetGroupId: tgtEx.supersetGroupId },
        data: { supersetGroupId: null },
      });
      updatedWeeks++;
    }

    return NextResponse.json({ ok: true, updatedWeeks });
  }

  // --- Template sets propagation ---
  const filterExerciseId: string | undefined =
    typeof body.exerciseId === "string" ? body.exerciseId : undefined;

  const sourceExercises = filterExerciseId
    ? sourceDay.exercises.filter((e) => e.id === filterExerciseId)
    : sourceDay.exercises;

  if (sourceExercises.length === 0) {
    return NextResponse.json({ error: "No matching exercises found" }, { status: 404 });
  }

  for (const week of subsequentWeeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    const hasLogs = targetDay.sessions.some((s) => s.loggedSets.length > 0);
    if (hasLogs) continue;

    for (const srcEx of sourceExercises) {
      const tgtEx = targetDay.exercises.find(
        (e) => e.name.toLowerCase() === srcEx.name.toLowerCase()
      );
      if (!tgtEx) continue;

      await prisma.exerciseSet.deleteMany({ where: { exerciseId: tgtEx.id } });

      if (srcEx.templateSets.length > 0) {
        await prisma.exerciseSet.createMany({
          data: srcEx.templateSets.map((s) => ({
            exerciseId: tgtEx.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetWeight: s.targetWeight,
            targetRir: s.targetRir,
          })),
        });
      }
    }
    updatedWeeks++;
  }

  return NextResponse.json({ ok: true, updatedWeeks });
}
