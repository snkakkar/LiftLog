import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST - Add a new day to the week.
 * Body: { name?: string }
 * New day gets next dayNumber (max + 1). No exercises; user can log sessions on it (empty workout) or add exercises later.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: weekId } = await params;
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { days: { orderBy: { dayNumber: "asc" } } },
  });
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  const maxDayNumber = week.days.length > 0
    ? Math.max(...week.days.map((d) => d.dayNumber))
    : 0;
  const newDayNumber = maxDayNumber + 1;

  const newDay = await prisma.workoutDay.create({
    data: { weekId, dayNumber: newDayNumber, name },
  });
  return NextResponse.json({ day: newDay, dayNumber: newDayNumber });
}
