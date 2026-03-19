import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const day = await prisma.workoutDay.findUnique({
    where: { id },
    include: {
      week: { include: { program: true } },
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          templateSets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });
  if (!day) {
    return NextResponse.json({ error: "Workout day not found" }, { status: 404 });
  }
  return NextResponse.json(day);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() || null : undefined;
  if (name === undefined) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const day = await prisma.workoutDay.update({
    where: { id },
    data: { name },
  });
  return NextResponse.json(day);
}
