import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const body = await request.json();
  const { completedAt, isDeload } = body;
  const data: Record<string, unknown> = {};
  if (completedAt != null) data.completedAt = new Date(completedAt);
  if (typeof isDeload === "boolean") data.isDeload = isDeload;
  const session = await prisma.workoutSession.update({
    where: { id, workoutDay: { week: { program: { userId } } } },
    data,
  });
  return NextResponse.json(session);
}
