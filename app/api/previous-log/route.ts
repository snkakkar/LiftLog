import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** GET ?exerciseId=... & ?exerciseName=... & optional ?programId=... & ?currentWeekNumber=...
 *  Returns last logged sets for this exercise. If programId and currentWeekNumber are provided,
 *  prefers sets from the same program in previous weeks (e.g. Week 8 when viewing Week 9). */
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  const exerciseId = request.nextUrl.searchParams.get("exerciseId");
  const exerciseName = request.nextUrl.searchParams.get("exerciseName")?.trim();
  const programId = request.nextUrl.searchParams.get("programId")?.trim() || null;
  const currentWeekNum = request.nextUrl.searchParams.get("currentWeekNumber");
  const currentWeekNumber = currentWeekNum ? parseInt(currentWeekNum, 10) : null;

  if (!exerciseId && !exerciseName) {
    return NextResponse.json(
      { error: "exerciseId or exerciseName required" },
      { status: 400 }
    );
  }

  let exerciseIds: string[] = [];
  if (exerciseName) {
    const exercises = await prisma.exercise.findMany({
      where: {
        name: exerciseName,
        workoutDay: { week: { program: { userId } } },
      },
      select: { id: true },
    });
    exerciseIds = exercises.map((e) => e.id);
  }
  if (exerciseIds.length === 0 && exerciseId) {
    const ex = await prisma.exercise.findFirst({
      where: { id: exerciseId, workoutDay: { week: { program: { userId } } } },
    });
    if (ex) exerciseIds = [ex.id];
  }
  if (exerciseIds.length === 0) {
    return NextResponse.json([]);
  }

  const baseWhere = {
    exerciseId: { in: exerciseIds },
    isWarmup: { not: true },
    workoutSession: { workoutDay: { week: { program: { userId } } } },
  } as const;

  // Prefer same program, previous weeks only (e.g. Week 8 when viewing Week 9).
  if (programId && currentWeekNumber != null && !isNaN(currentWeekNumber)) {
    const setsFromProgram = await prisma.loggedSet.findMany({
      where: {
        ...baseWhere,
        workoutSession: {
          workoutDay: {
            week: {
              programId,
              program: { userId },
              weekNumber: { lt: currentWeekNumber },
            },
          },
        },
      },
      orderBy: { completedAt: "desc" },
      take: 50,
      include: {
        workoutSession: {
          include: {
            workoutDay: {
              include: { week: { include: { program: true } } },
            },
          },
        },
      },
    });
    const withData = setsFromProgram.filter(
      (s) => (s.reps != null && s.reps > 0) || (s.weight != null)
    );
    // Limit to 2 weeks from most recent log (relative window)
    const limited = limitToTwoWeeksFromLatest(withData);
    return NextResponse.json(limited.slice(0, 20));
  }

  const sets = await prisma.loggedSet.findMany({
    where: baseWhere,
    orderBy: { completedAt: "desc" },
    take: 50,
    include: {
      workoutSession: {
        include: {
          workoutDay: {
            include: { week: { include: { program: true } } },
          },
        },
      },
    },
  });
  const withData = sets.filter(
    (s) => (s.reps != null && s.reps > 0) || (s.weight != null)
  );
  const limited = limitToTwoWeeksFromLatest(withData);
  return NextResponse.json(limited.slice(0, 20));
}

/** Keep only sets within 2 weeks of the most recent set (so we always show recent history when it exists). */
function limitToTwoWeeksFromLatest<T extends { completedAt: Date }>(sets: T[]): T[] {
  if (sets.length === 0) return [];
  const latest = new Date(sets[0].completedAt).getTime();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const cutoff = latest - twoWeeksMs;
  return sets.filter((s) => new Date(s.completedAt).getTime() >= cutoff);
}
