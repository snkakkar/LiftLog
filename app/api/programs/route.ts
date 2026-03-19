import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { getProgramsForUser } from "@/lib/repositories/programs";

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  const archivedOnly = request.nextUrl.searchParams.get("archived") === "1";
  const programs = await getProgramsForUser(userId, archivedOnly ? "archived" : "active");
  return NextResponse.json(programs);
}

/** Create a new empty program (no weeks). Use "Add week" and "Add day" on the program page, then add exercises from the workout day. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "New program";
    const program = await prisma.program.create({
      data: { userId, name },
    });
    return NextResponse.json(program);
  } catch (e) {
    console.error("Programs POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create program" },
      { status: 500 }
    );
  }
}
