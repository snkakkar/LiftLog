import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * POST - Create a new week in the program.
 * Body: { sourceWeekId?: string }
 * - If sourceWeekId: duplicate that week (same program): copy days, exercises, template sets. No sessions/logged sets.
 * - If no sourceWeekId: create an empty week with next weekNumber.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: programId } = await params;
  const program = await prisma.program.findUnique({
    where: { id: programId, userId },
    include: { weeks: { orderBy: { weekNumber: "asc" } } },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sourceWeekId = body.sourceWeekId as string | undefined;

  const maxWeekNumber = program.weeks.length > 0
    ? Math.max(...program.weeks.map((w) => w.weekNumber))
    : 0;
  const newWeekNumber = maxWeekNumber + 1;

  if (sourceWeekId) {
    const sourceWeek = await prisma.week.findFirst({
      where: { id: sourceWeekId, programId },
      include: {
        days: {
          orderBy: { dayNumber: "asc" },
          include: {
            exercises: {
              orderBy: { orderIndex: "asc" },
              include: { templateSets: { orderBy: { setNumber: "asc" } } },
            },
          },
        },
      },
    });
    if (!sourceWeek) {
      return NextResponse.json({ error: "Source week not found" }, { status: 404 });
    }

    const newWeek = await prisma.week.create({
      data: { programId, weekNumber: newWeekNumber },
    });
    for (const d of sourceWeek.days) {
      const newDay = await prisma.workoutDay.create({
        data: { weekId: newWeek.id, dayNumber: d.dayNumber, name: d.name },
      });
      for (let exIdx = 0; exIdx < d.exercises.length; exIdx++) {
        const ex = d.exercises[exIdx];
        const newEx = await prisma.exercise.create({
          data: {
            workoutDayId: newDay.id,
            name: ex.name,
            orderIndex: exIdx,
            substitution1: ex.substitution1,
            substitution2: ex.substitution2,
          },
        });
        for (const s of ex.templateSets) {
          await prisma.exerciseSet.create({
            data: {
              exerciseId: newEx.id,
              setNumber: s.setNumber,
              targetReps: s.targetReps,
              targetWeight: s.targetWeight,
              targetRir: s.targetRir,
            },
          });
        }
      }
    }
    return NextResponse.json({ week: newWeek, weekNumber: newWeekNumber });
  }

  const newWeek = await prisma.week.create({
    data: { programId, weekNumber: newWeekNumber },
  });
  return NextResponse.json({ week: newWeek, weekNumber: newWeekNumber });
}

/**
 * PATCH - Reorder weeks. Body: { weekIds: string[] } (order = new week 1, 2, 3...).
 * Does not change any session or logged set dates.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: programId } = await params;
  const program = await prisma.program.findUnique({
    where: { id: programId, userId },
    include: { weeks: true },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const weekIds = body.weekIds as string[] | undefined;
  if (!Array.isArray(weekIds) || weekIds.length === 0) {
    return NextResponse.json({ error: "weekIds array required" }, { status: 400 });
  }

  const validIds = new Set(program.weeks.map((w) => w.id));
  if (weekIds.some((id) => !validIds.has(id)) || weekIds.length !== validIds.size) {
    return NextResponse.json({ error: "weekIds must match program weeks exactly" }, { status: 400 });
  }

  await Promise.all(
    weekIds.map((id, i) =>
      prisma.week.update({
        where: { id },
        data: { weekNumber: i + 1 },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
