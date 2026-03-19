import { NextRequest, NextResponse } from "next/server";
import type { ImportProgram } from "@/lib/import/types";
import { importProgramToDb } from "@/lib/import/to-db";
import { requireUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const program = body as ImportProgram;
    const name = typeof program.name === "string" ? program.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Program name is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
      return NextResponse.json(
        { error: "At least one week with days is required" },
        { status: 400 }
      );
    }
    const programId = await importProgramToDb({ ...program, name }, userId);
    return NextResponse.json({ programId });
  } catch (e) {
    console.error("Import error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
