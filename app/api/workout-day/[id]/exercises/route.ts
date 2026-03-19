import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * POST - Add a new exercise to a workout day.
 * Body: { name: string }
 * Creates the exercise with one empty template set (setNumber 1) so the user can log and add more sets.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: workoutDayId } = await params;
  const day = await prisma.workoutDay.findFirst({
    where: { id: workoutDayId, week: { program: { userId } } },
    include: { exercises: { orderBy: { orderIndex: "asc" } } },
  });
  if (!day) return NextResponse.json({ error: "Workout day not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const nextOrderIndex =
    day.exercises.length > 0
      ? Math.max(...day.exercises.map((e) => e.orderIndex)) + 1
      : 0;

  const exercise = await prisma.exercise.create({
    data: {
      workoutDayId,
      name,
      orderIndex: nextOrderIndex,
    },
    include: {
      templateSets: { orderBy: { setNumber: "asc" } },
    },
  });

  await prisma.exerciseSet.create({
    data: {
      exerciseId: exercise.id,
      setNumber: 1,
      targetReps: null,
      targetWeight: null,
      targetRir: null,
    },
  });

  const withSet = await prisma.exercise.findUnique({
    where: { id: exercise.id },
    include: { templateSets: { orderBy: { setNumber: "asc" } } },
  });

  return NextResponse.json(withSet ?? exercise);
}

/**
 * PATCH - Reorder exercises in the workout day. Body: { orderedExerciseIds: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: workoutDayId } = await params;
  const day = await prisma.workoutDay.findFirst({
    where: { id: workoutDayId, week: { program: { userId } } },
    include: { exercises: true },
  });
  if (!day) return NextResponse.json({ error: "Workout day not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const orderedIds = body.orderedExerciseIds as string[] | undefined;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedExerciseIds array required" }, { status: 400 });
  }
  const validIds = new Set(day.exercises.map((e) => e.id));
  if (orderedIds.some((id) => !validIds.has(id)) || orderedIds.length !== validIds.size) {
    return NextResponse.json(
      { error: "orderedExerciseIds must match this day's exercises exactly" },
      { status: 400 }
    );
  }

  await Promise.all(
    orderedIds.map((id, i) =>
      prisma.exercise.update({
        where: { id },
        data: { orderIndex: i },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
