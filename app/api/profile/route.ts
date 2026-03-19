import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  const userId = await requireUserId();
  const profile = await prisma.profile.findFirst({ where: { userId } });
  return NextResponse.json(profile ?? null);
}

export async function PATCH(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json();
  const data: { heightCm?: number | null; age?: number | null; gender?: string | null } = {};
  if (body.heightCm !== undefined) data.heightCm = body.heightCm == null ? null : Number(body.heightCm);
  if (body.age !== undefined) data.age = body.age == null ? null : Math.max(0, Math.floor(Number(body.age)));
  if (body.gender !== undefined) data.gender = body.gender == null || body.gender === "" ? null : String(body.gender).trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  let profile = await prisma.profile.findFirst({ where: { userId } });
  if (profile) {
    profile = await prisma.profile.update({ where: { id: profile.id }, data });
  } else {
    profile = await prisma.profile.create({ data: { userId, ...data } });
  }

  return NextResponse.json(profile);
}
