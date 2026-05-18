import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import {
  ACTIVITY_KINDS,
  createActivity,
  listActivitiesForUser,
  type ActivityKind,
} from "@/lib/repositories/activity";

export async function GET() {
  const userId = await requireUserId();
  const items = await listActivitiesForUser(userId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json().catch(() => ({}));

  const kindRaw = typeof body.kind === "string" ? body.kind : "";
  if (!ACTIVITY_KINDS.includes(kindRaw as ActivityKind)) {
    return NextResponse.json(
      { error: `kind must be one of ${ACTIVITY_KINDS.join(", ")}` },
      { status: 400 }
    );
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const startedAt =
    typeof body.startedAt === "string" && body.startedAt
      ? new Date(body.startedAt)
      : null;
  if (startedAt && Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "startedAt must be a valid ISO date" }, { status: 400 });
  }

  const durationMin = body.durationMin != null ? Math.max(0, Math.floor(Number(body.durationMin))) : null;
  const distanceMi = body.distanceMi != null ? Math.max(0, Number(body.distanceMi)) : null;
  const rpeRaw = body.rpe != null ? Math.floor(Number(body.rpe)) : null;
  const rpe = rpeRaw != null ? Math.max(1, Math.min(10, rpeRaw)) : null;
  const note = typeof body.note === "string" ? body.note : null;

  const created = await createActivity(userId, {
    kind: kindRaw as ActivityKind,
    name,
    startedAt,
    durationMin: Number.isFinite(durationMin as number) ? (durationMin as number) : null,
    distanceMi: Number.isFinite(distanceMi as number) ? (distanceMi as number) : null,
    rpe,
    note,
  });
  return NextResponse.json(created);
}
