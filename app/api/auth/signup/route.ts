import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/services/user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;

    const result = await createUser({ email, password, name });

    if ("code" in result) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ id: result.id, email: result.email, name: result.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Signup error:", e);
    return NextResponse.json(
      { error: msg.includes("DATABASE") || msg.includes("postgresql://") ? "Database connection failed. Check Vercel env vars." : msg },
      { status: 500 }
    );
  }
}
