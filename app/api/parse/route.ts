import { NextRequest, NextResponse } from "next/server";
import { parseFromFile } from "@/lib/import/pipeline";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buf = await file.arrayBuffer();
    const fileName = file.name || "upload.xlsx";
    const program = await parseFromFile(buf, fileName);
    return NextResponse.json(program);
  } catch (e) {
    console.error("Parse error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 }
    );
  }
}
