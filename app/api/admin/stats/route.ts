import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const count = await prisma.user.count();
    return NextResponse.json({ userCount: count });
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden: admin only")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
