import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/**
 * PATCH - Update week (e.g. startDate). Body: { startDate?: string | null }
 * startDate: ISO date string (YYYY-MM-DD) or null to clear.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: weekId } = await params;
  const week = await prisma.week.findUnique({
    where: { id: weekId, program: { userId } },
  });
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body.startDate === undefined) {
    return NextResponse.json({ error: "startDate required" }, { status: 400 });
  }
  let startDate: Date | null = null;
  if (body.startDate != null && body.startDate !== "") {
    const parsed = new Date(body.startDate);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }
    startDate = parsed;
  }

  const updated = await prisma.week.update({
    where: { id: weekId },
    data: { startDate },
  });
  return NextResponse.json(updated);
}

/**
 * DELETE - Remove a week and all its days, exercises, sessions, logged sets.
 * Does not change any dates on other weeks or sessions.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: weekId } = await params;
  const week = await prisma.week.findUnique({
    where: { id: weekId, program: { userId } },
  });
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  await prisma.week.delete({ where: { id: weekId } });
  return NextResponse.json({ ok: true });
}
