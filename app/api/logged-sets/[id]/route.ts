import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

/** DELETE - Remove a logged set from history */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  try {
    await prisma.loggedSet.delete({
      where: {
        id,
        workoutSession: { workoutDay: { week: { program: { userId } } } },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Logged set not found or already deleted" }, { status: 404 });
  }
}
