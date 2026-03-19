import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const workoutDayId = body?.workoutDayId ?? null;
    if (!workoutDayId || typeof workoutDayId !== "string") {
      return NextResponse.json(
        { error: "workoutDayId required" },
        { status: 400 }
      );
    }
    const day = await prisma.workoutDay.findFirst({
      where: { id: workoutDayId, week: { program: { userId } } },
    });
    if (!day) {
      return NextResponse.json({ error: "Workout day not found" }, { status: 404 });
    }
    const session = await prisma.workoutSession.create({
      data: { workoutDayId },
    });
    return NextResponse.json(session);
  } catch (e) {
    console.error("Sessions POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
