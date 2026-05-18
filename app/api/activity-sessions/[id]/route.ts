import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteActivity } from "@/lib/repositories/activity";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const result = await deleteActivity(userId, id);
  if (result.count === 0) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
