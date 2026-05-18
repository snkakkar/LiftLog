import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { propagate, type PropagateInput } from "@/lib/services/programPropagation";

/**
 * POST - Propagate a structural change on this day to the same dayNumber in all subsequent weeks.
 *
 * Preferred body: { kind: "templateSets" | "rename" | "exerciseOrder" | "supersetPair" | "supersetClear", ...payload }
 *
 * Legacy body shapes (still accepted, inferred to a kind):
 *   { exerciseId?: string }                                   → templateSets
 *   { renameTo: string, oldName: string }                     → rename
 *   { supersetGroupId: string }                               → supersetPair
 *   { removeSupersetExerciseId: string }                      → supersetClear
 *
 * Always skips target days that already have logged sets (except rename, which does not
 * mutate completed history because logs reference exerciseId, not name).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id: workoutDayId } = await params;
  const body = await request.json().catch(() => ({}));

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ error: "Unrecognized propagate payload" }, { status: 400 });
  }

  const result = await propagate(workoutDayId, userId, input);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, updatedWeeks: result.updatedWeeks });
}

function parseInput(body: Record<string, unknown>): PropagateInput | null {
  if (typeof body.kind === "string") {
    switch (body.kind) {
      case "templateSets":
        return { kind: "templateSets", exerciseId: typeof body.exerciseId === "string" ? body.exerciseId : undefined };
      case "rename":
        if (typeof body.oldName !== "string" || typeof body.newName !== "string") return null;
        return { kind: "rename", oldName: body.oldName, newName: body.newName };
      case "exerciseOrder":
        if (!Array.isArray(body.orderedExerciseIds)) return null;
        return { kind: "exerciseOrder", orderedExerciseIds: body.orderedExerciseIds.filter((x): x is string => typeof x === "string") };
      case "supersetPair":
        if (typeof body.supersetGroupId !== "string") return null;
        return { kind: "supersetPair", supersetGroupId: body.supersetGroupId };
      case "supersetClear":
        if (typeof body.exerciseId !== "string") return null;
        return { kind: "supersetClear", exerciseId: body.exerciseId };
      default:
        return null;
    }
  }
  // Legacy payloads
  if (typeof body.supersetGroupId === "string") {
    return { kind: "supersetPair", supersetGroupId: body.supersetGroupId };
  }
  if (typeof body.removeSupersetExerciseId === "string") {
    return { kind: "supersetClear", exerciseId: body.removeSupersetExerciseId };
  }
  if (typeof body.renameTo === "string" && typeof body.oldName === "string") {
    return { kind: "rename", oldName: body.oldName, newName: body.renameTo };
  }
  // Default: template sets (with optional exerciseId)
  return { kind: "templateSets", exerciseId: typeof body.exerciseId === "string" ? body.exerciseId : undefined };
}
