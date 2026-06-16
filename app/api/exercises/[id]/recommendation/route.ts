import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProgressionSuggestion } from "@/lib/progression/recommend";
import { requireUserId, userScope } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: exerciseId } = await params;
    const programId = request.nextUrl.searchParams.get("programId")?.trim() || null;
    const currentWeekNum = request.nextUrl.searchParams.get("currentWeekNumber");
    const currentWeekNumber = currentWeekNum ? parseInt(currentWeekNum, 10) : null;

    const exercise = await prisma.exercise.findFirst({
      where: { id: exerciseId, ...userScope.exercise(userId) },
      include: {
        templateSets: { orderBy: { setNumber: "asc" } },
      },
    });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const sameNameExercises = await prisma.exercise.findMany({
      where: { name: exercise.name, ...userScope.exercise(userId) },
      select: { id: true },
    });
    const exerciseIds = sameNameExercises.map((e) => e.id);
    if (!exerciseIds.includes(exercise.id)) exerciseIds.push(exercise.id);

    const baseWhere = {
      exerciseId: { in: exerciseIds },
      isWarmup: { not: true },
      isFormDeload: { not: true },
      ...userScope.loggedSet(userId),
    } as const;

    const recentFromProgram =
      programId && currentWeekNumber != null && !isNaN(currentWeekNumber)
        ? await prisma.loggedSet.findMany({
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
            take: 10,
          })
        : [];

    const lastSets = recentFromProgram.length
      ? recentFromProgram
      : await prisma.loggedSet.findMany({
          where: baseWhere,
      orderBy: { completedAt: "desc" },
      take: 10,
    });

    const template = exercise.templateSets.map((s) => ({
      targetReps: s.targetReps,
      targetWeight: s.targetWeight,
      targetRir: s.targetRir,
    }));
    const logged = lastSets.map((s) => ({
      reps: s.reps,
      weight: s.weight,
      rir: s.rir,
      isWarmup: s.isWarmup,
      isFormDeload: s.isFormDeload,
    }));

    const { suggestion, repRangeText } = getProgressionSuggestion(template, logged);
    return NextResponse.json({ suggestion, repRangeText });
  } catch (e) {
    console.error("Recommendation error:", e);
    return NextResponse.json({ suggestion: null, repRangeText: "" });
  }
}
