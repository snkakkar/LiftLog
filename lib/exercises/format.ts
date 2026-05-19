/**
 * Display-format helpers for exercise data shown in the workout UI.
 * Pure functions, no React or Prisma dependencies.
 */

/**
 * Coerce an unknown value into a safe display name. Defends against the
 * `"[object Object]"` rendering that happens when a non-string slips through
 * (older logs occasionally carried serialized objects in the name field).
 */
export function safeExerciseName(name: unknown): string {
  if (typeof name === "string") return name;
  const s = String(name ?? "");
  return s.replace(/^\[object \w+\]$/, "") || "Exercise";
}

/**
 * Format a target rep count as a human-readable label.
 * - `(10, null)` → `"10 reps"`
 * - `(12, 8)`    → `"8–12 reps"`
 * - `(null, _)`  → `""`
 *
 * Min is only used when it's a valid range strictly below max.
 */
export function repRangeLabel(
  targetReps: number | null,
  targetRepsMin?: number | null
): string {
  if (targetReps == null || targetReps < 1) return "";
  if (targetRepsMin != null && targetRepsMin >= 1 && targetRepsMin < targetReps) {
    return `${targetRepsMin}–${targetReps} reps`;
  }
  return `${targetReps} reps`;
}

/**
 * Heuristic: should this exercise's stored weight include the lifter's body weight?
 * Matches common bodyweight movement names after stripping spaces/dashes/underscores.
 * Used by the logger to bake body weight into stored weight (so history is honest)
 * and to label the input as "Added weight".
 */
export function isBodyweightExercise(name: string): boolean {
  const n = name.toLowerCase().replace(/[-_\s]+/g, "");
  return (
    n.includes("dip") ||
    n.includes("pullup") ||
    n.includes("chinup") ||
    n.includes("pushup") ||
    n.includes("muscleup") ||
    n.includes("ringrow") ||
    n.includes("invertedrow")
  );
}
