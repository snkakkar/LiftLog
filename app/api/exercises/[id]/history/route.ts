import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** GET - logged sets for this exercise, newest first */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: exerciseId } = await params;

  const sets = await prisma.loggedSet.findMany({
    where: {
      exerciseId,
      isWarmup: { not: true },
      workoutSession: { workoutDay: { week: { program: { userId } } } },
    },
    orderBy: { completedAt: "desc" },
    take: 500,
    include: {
      exercise: { select: { name: true } },
      workoutSession: {
        include: {
          workoutDay: {
            include: { week: { include: { program: true } } },
          },
        },
      },
    },
  });
  return NextResponse.json(sets);
}
