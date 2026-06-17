import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, userScope } from "@/lib/auth";
import { selectRecentWorkoutHistory } from "@/lib/logged-sets/recent-history";

/** GET ?exerciseId=... & ?exerciseName=... & optional ?programId=... & ?currentWeekNumber=...
 *  Returns most recent logged sets for this exercise.
 *  Week boundaries are used for structure only and never block latest-history lookup. */
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
      where: { name: exerciseName, ...userScope.exercise(userId) },
      select: { id: true },
    });
    exerciseIds = exercises.map((e) => e.id);
  }
  if (exerciseIds.length === 0 && exerciseId) {
    const ex = await prisma.exercise.findFirst({
      where: { id: exerciseId, ...userScope.exercise(userId) },
    });
    if (ex) exerciseIds = [ex.id];
  }
  if (exerciseIds.length === 0) {
    return NextResponse.json([]);
  }

  const baseWhere = {
    exerciseId: { in: exerciseIds },
    isWarmup: { not: true },
    isFormDeload: { not: true },
    ...userScope.loggedSet(userId),
  } as const;

  // Prefer same program context first, but never filter out by week number.
  if (programId && currentWeekNumber != null && !isNaN(currentWeekNumber)) {
    const setsFromProgram = await prisma.loggedSet.findMany({
      where: {
        ...baseWhere,
        workoutSession: {
          workoutDay: {
            week: {
              programId,
              program: { userId },
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
    const withData = selectRecentWorkoutHistory(setsFromProgram, 2);
    if (withData.length > 0) {
      return NextResponse.json(withData);
    }
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
  const withData = selectRecentWorkoutHistory(sets, 2);
  return NextResponse.json(withData);
}
