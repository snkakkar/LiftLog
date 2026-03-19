import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** Start and end of "today" in local time (for filtering sessions by calendar day). */
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

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
      workoutDay: { week: { program: { userId } } },
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
