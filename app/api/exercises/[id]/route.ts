import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, userScope } from "@/lib/auth";
import { shouldForkExerciseIdentity } from "@/lib/exercises/rename-policy";

/** DELETE - Remove exercise from the workout day (template sets and logged sets for this exercise are removed). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id, ...userScope.exercise(userId) },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.supersetGroupId) {
    await prisma.exercise.updateMany({
      where: {
        workoutDayId: exercise.workoutDayId,
        supersetGroupId: exercise.supersetGroupId,
        id: { not: id },
      },
      data: { supersetGroupId: null },
    });
  }
  await prisma.exercise.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const createNewOnRename = body.createNewOnRename === true;
  let data: {
    name?: string;
    substitution1?: string | null;
    substitution2?: string | null;
    workoutDayId?: string;
    supersetGroupId?: string | null;
  } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.substitution1 !== undefined) data.substitution1 = body.substitution1 ? String(body.substitution1).trim() : null;
  if (body.substitution2 !== undefined) data.substitution2 = body.substitution2 ? String(body.substitution2).trim() : null;
  if (body.workoutDayId !== undefined) {
    const targetDayId = typeof body.workoutDayId === "string" ? body.workoutDayId.trim() : "";
    if (!targetDayId) {
      return NextResponse.json({ error: "workoutDayId must be a non-empty string" }, { status: 400 });
    }
    const targetDay = await prisma.workoutDay.findFirst({
      where: { id: targetDayId, ...userScope.workoutDay(userId) },
    });
    if (!targetDay) return NextResponse.json({ error: "Target day not found" }, { status: 404 });
    data.workoutDayId = targetDayId;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "name, substitution1, substitution2, or workoutDayId required" }, { status: 400 });
  }
  const exercise = await prisma.exercise.findFirst({
    where: { id, ...userScope.exercise(userId) },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  if (createNewOnRename && typeof data.name === "string" && data.name && data.name !== exercise.name) {
    const hasLogs = await prisma.loggedSet.findFirst({
      where: { exerciseId: exercise.id },
      select: { id: true },
    });
    if (!shouldForkExerciseIdentity(Boolean(hasLogs))) {
      return NextResponse.json(
        { error: "Cannot rename an exercise with existing logs in-place. Use future-week apply flow." },
        { status: 409 }
      );
    }

    const replacement = await prisma.$transaction(async (tx) => {
      const created = await tx.exercise.create({
        data: {
          workoutDayId: exercise.workoutDayId,
          name: data.name as string,
          orderIndex: exercise.orderIndex,
          substitution1: data.substitution1 !== undefined ? data.substitution1 : exercise.substitution1,
          substitution2: data.substitution2 !== undefined ? data.substitution2 : exercise.substitution2,
          supersetGroupId: exercise.supersetGroupId,
        },
      });

      const templateSets = await tx.exerciseSet.findMany({
        where: { exerciseId: exercise.id },
        orderBy: { setNumber: "asc" },
      });
      if (templateSets.length > 0) {
        await tx.exerciseSet.createMany({
          data: templateSets.map((s) => ({
            exerciseId: created.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetRepsMin: s.targetRepsMin,
            targetWeight: s.targetWeight,
            targetRir: s.targetRir,
          })),
        });
      } else {
        await tx.exerciseSet.create({
          data: {
            exerciseId: created.id,
            setNumber: 1,
            targetReps: null,
            targetWeight: null,
            targetRir: null,
          },
        });
      }

      await tx.exercise.delete({ where: { id: exercise.id } });
      return created;
    });

    return NextResponse.json(replacement);
  }

  if (data.workoutDayId != null && data.workoutDayId !== exercise.workoutDayId && exercise.supersetGroupId) {
    await prisma.exercise.updateMany({
      where: {
        workoutDayId: exercise.workoutDayId,
        supersetGroupId: exercise.supersetGroupId,
        id: { not: id },
      },
      data: { supersetGroupId: null },
    });
    data = { ...data, supersetGroupId: null };
  }

  const updated = await prisma.exercise.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
