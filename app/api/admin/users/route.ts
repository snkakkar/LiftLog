import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createUser } from "@/lib/services/user";
import { requireAdminErrorResponse } from "@/lib/http/api";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const tempPassword = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;

    const result = await createUser({ email, password: tempPassword, name });

    if ("code" in result) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      id: result.id,
      email: result.email,
      name: result.name,
      tempPassword: tempPassword,
      message: "User created. Share the temp password with the user—they should change it after first login.",
    });
  } catch (e) {
    const res = requireAdminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
