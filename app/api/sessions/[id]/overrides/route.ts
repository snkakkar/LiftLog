import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** GET - list display overrides for this session */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: sessionId } = await params;
  const overrides = await prisma.exerciseOverride.findMany({
    where: {
      workoutSessionId: sessionId,
      workoutSession: { workoutDay: { week: { program: { userId } } } },
    },
  });
  return NextResponse.json(
    overrides.map((o) => ({ exerciseId: o.exerciseId, displayName: o.displayName, note: o.note }))
  );
}

/** POST - set or update display name for one exercise in this session. Body: { exerciseId, displayName } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: sessionId } = await params;
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, workoutDay: { week: { program: { userId } } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const body = await request.json();
  const { exerciseId, displayName, note } = body;
  if (!exerciseId || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json(
      { error: "exerciseId and displayName (non-empty string) required" },
      { status: 400 }
    );
  }
  const override = await prisma.exerciseOverride.upsert({
    where: {
      workoutSessionId_exerciseId: { workoutSessionId: sessionId, exerciseId },
    },
    create: {
      workoutSessionId: sessionId,
      exerciseId,
      displayName: displayName.trim(),
      note: typeof note === "string" ? note.trim() || null : null,
    },
    update: {
      displayName: displayName.trim(),
      note: typeof note === "string" ? note.trim() || null : undefined,
    },
  });
  return NextResponse.json(override);
}

/** DELETE - remove override for an exercise. Query: ?exerciseId=... */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: sessionId } = await params;
  const exerciseId = request.nextUrl.searchParams.get("exerciseId");
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
  await prisma.exerciseOverride.deleteMany({
    where: {
      workoutSessionId: sessionId,
      exerciseId,
      workoutSession: { workoutDay: { week: { program: { userId } } } },
    },
  });
  return NextResponse.json({ ok: true });
}
