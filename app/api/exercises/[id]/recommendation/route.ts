import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProgressionSuggestion } from "@/lib/progression/recommend";
import { requireUserId } from "@/lib/auth";

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
      where: { id: exerciseId, workoutDay: { week: { program: { userId } } } },
      include: {
        templateSets: { orderBy: { setNumber: "asc" } },
      },
    });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const whereClause =
      programId && currentWeekNumber != null && !isNaN(currentWeekNumber)
        ? {
            exerciseId,
            isWarmup: { not: true },
            workoutSession: {
              workoutDay: {
                week: {
                  programId,
                  program: { userId },
                  weekNumber: { lt: currentWeekNumber },
                },
              },
            },
          }
        : {
            exerciseId,
            isWarmup: { not: true },
            workoutSession: { workoutDay: { week: { program: { userId } } } },
          };

    const lastSets = await prisma.loggedSet.findMany({
      where: whereClause,
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
    }));

    const { suggestion, repRangeText } = getProgressionSuggestion(template, logged);
    return NextResponse.json({ suggestion, repRangeText });
  } catch (e) {
    console.error("Recommendation error:", e);
    return NextResponse.json({ suggestion: null, repRangeText: "" });
  }
}
