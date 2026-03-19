import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name: name ?? email.split("@")[0], passwordHash },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Signup error:", e);
    // Surface error for debugging (remove in production if sensitive)
    return NextResponse.json(
      { error: msg.includes("DATABASE") || msg.includes("postgresql://") ? "Database connection failed. Check Vercel env vars." : msg },
      { status: 500 }
    );
  }
}
