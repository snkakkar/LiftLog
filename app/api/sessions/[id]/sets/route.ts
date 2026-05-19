import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, userScope } from "@/lib/auth";

/** GET - returns all logged sets for this session */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const sets = await prisma.loggedSet.findMany({
    where: { workoutSessionId: id, ...userScope.loggedSet(userId) },
    orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
  });
  return NextResponse.json(sets);
}
