import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** GET - List all workout days in the program (for "Move exercise to day" dropdown). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: programId } = await params;
  const program = await prisma.program.findUnique({
    where: { id: programId, userId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { dayNumber: "asc" } },
        },
      },
    },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const days: { id: string; weekNumber: number; dayNumber: number; name: string | null }[] = [];
  for (const w of program.weeks) {
    for (const d of w.days) {
      days.push({
        id: d.id,
        weekNumber: w.weekNumber,
        dayNumber: d.dayNumber,
        name: d.name,
      });
    }
  }
  return NextResponse.json({ days });
}
