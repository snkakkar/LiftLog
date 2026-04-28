import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * POST - Propagate this day's exercise template (set counts + targets) to the same
 * dayNumber in all subsequent weeks of the same program.
 *
 * Only updates exercises whose name matches one in the source day (matched by name,
 * case-insensitive). Skips days that have logged sets to avoid overwriting real data.
 *
 * Body: { exerciseId?: string } — if provided, propagates only that exercise;
 *   otherwise propagates all exercises on the day.
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
  const filterExerciseId: string | undefined =
    typeof body.exerciseId === "string" ? body.exerciseId : undefined;

  const sourceExercises = filterExerciseId
    ? sourceDay.exercises.filter((e) => e.id === filterExerciseId)
    : sourceDay.exercises;

  if (sourceExercises.length === 0) {
    return NextResponse.json({ error: "No matching exercises found" }, { status: 404 });
  }

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
          sessions: {
            include: { loggedSets: { take: 1 } },
          },
        },
      },
    },
  });

  let updatedWeeks = 0;

  for (const week of subsequentWeeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;

    // Skip days that have any logged sets (real workout data)
    const hasLogs = targetDay.sessions.some((s) => s.loggedSets.length > 0);
    if (hasLogs) continue;

    for (const srcEx of sourceExercises) {
      // Match by name (case-insensitive)
      const tgtEx = targetDay.exercises.find(
        (e) => e.name.toLowerCase() === srcEx.name.toLowerCase()
      );
      if (!tgtEx) continue;

      // Delete existing template sets on the target exercise
      await prisma.exerciseSet.deleteMany({ where: { exerciseId: tgtEx.id } });

      // Re-create with same set counts + targets as source
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
