import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { requireAdminErrorResponse } from "@/lib/http/api";

export async function GET() {
  try {
    await requireAdmin();
    const count = await prisma.user.count();
    return NextResponse.json({ userCount: count });
  } catch (e) {
    const res = requireAdminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
