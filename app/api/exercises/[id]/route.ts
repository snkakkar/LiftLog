import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** DELETE - Remove exercise from the workout day (template sets and logged sets for this exercise are removed). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id, workoutDay: { week: { program: { userId } } } },
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
      where: { id: targetDayId, week: { program: { userId } } },
    });
    if (!targetDay) return NextResponse.json({ error: "Target day not found" }, { status: 404 });
    data.workoutDayId = targetDayId;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "name, substitution1, substitution2, or workoutDayId required" }, { status: 400 });
  }
  const exercise = await prisma.exercise.findFirst({
    where: { id, workoutDay: { week: { program: { userId } } } },
  });
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

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
