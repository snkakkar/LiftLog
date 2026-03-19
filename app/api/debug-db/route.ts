import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Temporary debug endpoint to verify DB connection and user existence.
 * Remove or protect this in production.
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const migratedUser = await prisma.user.findUnique({
      where: { email: "migrated@liftlog.local" },
      select: { id: true, email: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      userCount,
      migratedUserExists: !!migratedUser,
      migratedUser: migratedUser ? { id: migratedUser.id, email: migratedUser.email } : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
