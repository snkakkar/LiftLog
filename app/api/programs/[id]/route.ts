import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { getProgramById } from "@/lib/repositories/programs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const program = await getProgramById(id, userId);
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  return NextResponse.json(program);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const body = await request.json();
  const data: { name?: string; archivedAt?: Date | null } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.archive === true) data.archivedAt = new Date();
  if (body.archive === false) data.archivedAt = null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "name or archive required" }, { status: 400 });
  }
  if (data.name === "") delete data.name;
  const program = await prisma.program.update({
    where: { id, userId },
    data,
  });
  return NextResponse.json(program);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  await prisma.program.delete({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}

/** POST - duplicate program (structure only, no logs) */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: sourceId } = await params;
  const source = await prisma.program.findUnique({
    where: { id: sourceId, userId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              exercises: { orderBy: { orderIndex: "asc" }, include: { templateSets: { orderBy: { setNumber: "asc" } } } },
            },
          },
        },
      },
    },
  });
  if (!source) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const program = await prisma.program.create({
    data: {
      userId,
      name: `${source.name} (copy)`,
      description: source.description,
    },
  });

  for (const w of source.weeks) {
    const week = await prisma.week.create({
      data: { programId: program.id, weekNumber: w.weekNumber },
    });
    for (const d of w.days) {
      const day = await prisma.workoutDay.create({
        data: { weekId: week.id, dayNumber: d.dayNumber, name: d.name },
      });
      for (const ex of d.exercises) {
        const exercise = await prisma.exercise.create({
          data: {
            workoutDayId: day.id,
            name: ex.name,
            orderIndex: ex.orderIndex,
            substitution1: ex.substitution1,
            substitution2: ex.substitution2,
          },
        });
        for (const s of ex.templateSets) {
          await prisma.exerciseSet.create({
            data: {
              exerciseId: exercise.id,
              setNumber: s.setNumber,
              targetReps: s.targetReps,
              targetWeight: s.targetWeight,
              targetRir: s.targetRir,
            },
          });
        }
      }
    }
  }
  return NextResponse.json({ programId: program.id, program });
}
