import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** Log or update a set. If a set already exists for this session + exercise + setNumber, it is updated (overwrite). */
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json().catch(() => ({}));
  const { workoutSessionId, exerciseId, setNumber, reps, weight, rir, isWarmup } = body;
  if (!workoutSessionId || !exerciseId || setNumber == null) {
    return NextResponse.json(
      { error: "workoutSessionId, exerciseId, setNumber required" },
      { status: 400 }
    );
  }
  const session = await prisma.workoutSession.findFirst({
    where: { id: workoutSessionId, workoutDay: { week: { program: { userId } } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const setNum = Number(setNumber);
  const data = {
    reps: reps != null ? Number(reps) : null,
    weight: weight != null ? Number(weight) : null,
    rir: rir != null ? Number(rir) : null,
    isWarmup: isWarmup === true,
  };
  const existing = await prisma.loggedSet.findFirst({
    where: { workoutSessionId, exerciseId, setNumber: setNum },
  });
  const logged = existing
    ? await prisma.loggedSet.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.loggedSet.create({
        data: {
          workoutSessionId,
          exerciseId,
          setNumber: setNum,
          ...data,
        },
      });
  return NextResponse.json(logged);
}
