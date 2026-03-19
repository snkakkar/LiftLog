import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const tempPassword = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!tempPassword || tempPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
    }

    const passwordHash = await hash(tempPassword, 12);
    const user = await prisma.user.create({
      data: { email, name: name ?? email.split("@")[0], passwordHash },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tempPassword: tempPassword,
      message: "User created. Share the temp password with the user—they should change it after first login.",
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden: admin only")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
