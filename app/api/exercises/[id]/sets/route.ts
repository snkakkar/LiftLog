import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * POST - Add a new template set to an exercise (next set number).
 * Body: { targetReps?: number; targetWeight?: number; targetRir?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: exerciseId } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, workoutDay: { week: { program: { userId } } } },
    include: { templateSets: { orderBy: { setNumber: "asc" } } },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const targetReps = body.targetReps != null ? Number(body.targetReps) : null;
  const targetWeight = body.targetWeight != null ? Number(body.targetWeight) : null;
  const targetRir = body.targetRir != null ? Math.max(0, Math.floor(Number(body.targetRir))) : null;

  const nextSetNumber =
    exercise.templateSets.length > 0
      ? Math.max(...exercise.templateSets.map((s) => s.setNumber)) + 1
      : 1;

  const newSet = await prisma.exerciseSet.create({
    data: {
      exerciseId,
      setNumber: nextSetNumber,
      targetReps,
      targetWeight,
      targetRir,
    },
  });
  return NextResponse.json(newSet);
}

/**
 * PATCH - Reorder template sets. Body: { orderedSetIds: string[] }
 * Sets get setNumber 1, 2, 3... by array order. Does not change any logged set dates.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: exerciseId } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, workoutDay: { week: { program: { userId } } } },
    include: { templateSets: true },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const orderedSetIds = body.orderedSetIds as string[] | undefined;
  if (!Array.isArray(orderedSetIds) || orderedSetIds.length === 0) {
    return NextResponse.json({ error: "orderedSetIds array required" }, { status: 400 });
  }

  const validIds = new Set(exercise.templateSets.map((s) => s.id));
  if (
    orderedSetIds.some((id) => !validIds.has(id)) ||
    orderedSetIds.length !== validIds.size
  ) {
    return NextResponse.json(
      { error: "orderedSetIds must match exercise template sets exactly" },
      { status: 400 }
    );
  }

  await Promise.all(
    orderedSetIds.map((id, i) =>
      prisma.exerciseSet.update({
        where: { id },
        data: { setNumber: i + 1 },
      })
    )
  );
  return NextResponse.json({ ok: true });
}

/**
 * DELETE - Remove a template set from an exercise. Body: { setId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: exerciseId } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, workoutDay: { week: { program: { userId } } } },
    include: { templateSets: true },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const setId = body.setId as string | undefined;
  if (!setId || typeof setId !== "string") {
    return NextResponse.json({ error: "setId required" }, { status: 400 });
  }

  const valid = exercise.templateSets.some((s) => s.id === setId);
  if (!valid) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  await prisma.exerciseSet.delete({ where: { id: setId } });
  return NextResponse.json({ ok: true });
}
