import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, userScope } from "@/lib/auth";
import { getTodayRange } from "@/lib/time";

/** GET ?workoutDayId=... - returns a session for this workout day only if it started today (so logs go to today's date). Otherwise null so client creates a new session. */
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  const workoutDayId = request.nextUrl.searchParams.get("workoutDayId");
  if (!workoutDayId) {
    return NextResponse.json(
      { error: "workoutDayId required" },
      { status: 400 }
    );
  }
  const { start: startOfToday, end: endOfToday } = getTodayRange();
  const sessions = await prisma.workoutSession.findMany({
    where: {
      workoutDayId,
      ...userScope.workoutSession(userId),
      startedAt: { gte: startOfToday, lt: endOfToday },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { _count: { select: { loggedSets: true } } },
  });
  const withSets = sessions.filter((s) => s._count.loggedSets > 0);
  const session = (withSets.length > 0 ? withSets[0] : sessions[0]) ?? null;
  if (!session) return NextResponse.json(null);
  const { _count, ...rest } = session;
  return NextResponse.json(rest);
}
