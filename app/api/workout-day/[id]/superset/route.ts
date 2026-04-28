import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

async function findTodaysSessionForDay(workoutDayId: string, userId: string) {
  const { start, end } = getTodayRange();
  const sessions = await prisma.workoutSession.findMany({
    where: {
      workoutDayId,
      workoutDay: { week: { program: { userId } } },
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { _count: { select: { loggedSets: true } } },
  });
  const withSets = sessions.filter((s) => s._count.loggedSets > 0);
  return (withSets.length > 0 ? withSets[0] : sessions[0]) ?? null;
}

async function maxLoggedSetNumber(sessionId: string, exerciseId: string): Promise<number> {
  const agg = await prisma.loggedSet.aggregate({
    where: { workoutSessionId: sessionId, exerciseId },
    _max: { setNumber: true },
  });
  return agg._max.setNumber ?? 0;
}

/**
 * POST — Pair two exercises on this workout day as a superset.
 * Body: { exerciseIdA: string, exerciseIdB: string }
 * Clears any previous superset membership for either exercise (and former partners).
 * Aligns template set counts so both exercises have the same number of rows (covers existing logs for today’s session).
 */
export async function POST(
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
  const a = typeof body.exerciseIdA === "string" ? body.exerciseIdA.trim() : "";
  const b = typeof body.exerciseIdB === "string" ? body.exerciseIdB.trim() : "";
  if (!a || !b || a === b) {
    return NextResponse.json(
      { error: "exerciseIdA and exerciseIdB must be distinct exercise ids" },
      { status: 400 }
    );
  }

  const valid = new Set(day.exercises.map((e) => e.id));
  if (!valid.has(a) || !valid.has(b)) {
    return NextResponse.json(
      { error: "Both exercises must belong to this workout day" },
      { status: 400 }
    );
  }

  const exA = day.exercises.find((e) => e.id === a)!;
  const exB = day.exercises.find((e) => e.id === b)!;
  const groupsToClear = new Set(
    [exA.supersetGroupId, exB.supersetGroupId].filter((g): g is string => Boolean(g))
  );

  const session = await findTodaysSessionForDay(workoutDayId, userId);

  await prisma.$transaction(async (tx) => {
    for (const gid of groupsToClear) {
      await tx.exercise.updateMany({
        where: { workoutDayId, supersetGroupId: gid },
        data: { supersetGroupId: null },
      });
    }

    const newGroupId = randomUUID();
    await tx.exercise.update({ where: { id: a }, data: { supersetGroupId: newGroupId } });
    await tx.exercise.update({ where: { id: b }, data: { supersetGroupId: newGroupId } });

    const [withA, withB] = await Promise.all([
      tx.exercise.findUnique({
        where: { id: a },
        include: { templateSets: { orderBy: { setNumber: "asc" } } },
      }),
      tx.exercise.findUnique({
        where: { id: b },
        include: { templateSets: { orderBy: { setNumber: "asc" } } },
      }),
    ]);
    if (!withA || !withB) throw new Error("Exercise missing after update");

    let target = Math.max(withA.templateSets.length, withB.templateSets.length, 1);
    if (session) {
      const [maxA, maxB] = await Promise.all([
        maxLoggedSetNumber(session.id, a),
        maxLoggedSetNumber(session.id, b),
      ]);
      target = Math.max(target, maxA, maxB, 1);
    }

    async function padTemplateRows(exerciseId: string) {
      let sets = await tx.exerciseSet.findMany({
        where: { exerciseId },
        orderBy: { setNumber: "asc" },
      });
      while (sets.length < target) {
        const nextNum =
          sets.length === 0 ? 1 : Math.max(...sets.map((s) => s.setNumber)) + 1;
        await tx.exerciseSet.create({
          data: {
            exerciseId,
            setNumber: nextNum,
            targetReps: null,
            targetWeight: null,
            targetRir: null,
          },
        });
        sets = await tx.exerciseSet.findMany({
          where: { exerciseId },
          orderBy: { setNumber: "asc" },
        });
      }
    }

    await padTemplateRows(a);
    await padTemplateRows(b);
  });

  const exercises = await prisma.exercise.findMany({
    where: { workoutDayId },
    orderBy: { orderIndex: "asc" },
    include: { templateSets: { orderBy: { setNumber: "asc" } } },
  });
  return NextResponse.json({ ok: true, exercises });
}

/**
 * DELETE — Remove superset pairing for an exercise (and its partner on the same day).
 * Body: { exerciseId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: workoutDayId } = await params;
  const body = await request.json().catch(() => ({}));
  const exerciseId = typeof body.exerciseId === "string" ? body.exerciseId.trim() : "";
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }

  const ex = await prisma.exercise.findFirst({
    where: { id: exerciseId, workoutDayId, workoutDay: { week: { program: { userId } } } },
  });
  if (!ex) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const gid = ex.supersetGroupId;
  if (!gid) {
    return NextResponse.json({ ok: true });
  }

  await prisma.exercise.updateMany({
    where: { workoutDayId, supersetGroupId: gid },
    data: { supersetGroupId: null },
  });
  return NextResponse.json({ ok: true });
}
