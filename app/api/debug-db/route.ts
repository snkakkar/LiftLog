import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Debug endpoint to verify DB connection. Disable or protect in production.
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
