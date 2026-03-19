import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json();
  const name = body.name !== undefined ? (body.name === "" || body.name == null ? null : String(body.name).trim()) : undefined;
  if (name === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { name: name ?? null },
  });
  return NextResponse.json({ ok: true });
}
