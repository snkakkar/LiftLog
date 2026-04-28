import type { ImportSet } from "./types";

/**
 * Parse a sets string from an import spreadsheet into ImportSet[].
 * Handles common notations:
 *   "3x8"        → 3 sets of 8 reps
 *   "3x8-10"     → 3 sets, repRange "8-10"
 *   "4x8 @135"   → 4 sets, weight 135
 *   "3x8 RIR2"   → 3 sets, rir 2
 *   "3"          → 3 sets, reps unknown
 *   ""           → 1 set, reps unknown
 */
export function parseSetsString(raw: string): ImportSet[] {
  const s = raw.trim();
  if (!s) return [];

  // Extract set count and rep spec: NxM or NXM (case-insensitive)
  const xMatch = s.match(/^(\d+)\s*[xX]\s*(\d+(?:-\d+)?)/);
  const setCount = xMatch ? parseInt(xMatch[1], 10) : (parseInt(s, 10) || 1);
  const repPart = xMatch ? xMatch[2] : null;

  // Rep range "8-10" vs exact "8"
  let reps: number | undefined;
  let repRange: string | undefined;
  if (repPart) {
    if (repPart.includes("-")) {
      repRange = repPart;
    } else {
      reps = parseInt(repPart, 10);
    }
  }

  // Weight: @135 or @135lb or @135kg
  const weightMatch = s.match(/@\s*(\d+(?:\.\d+)?)\s*(?:lb|kg)?/i);
  const weight = weightMatch ? parseFloat(weightMatch[1]) : undefined;

  // RIR: RIR2 or RIR 2
  const rirMatch = s.match(/\brir\s*(\d+)/i);
  const rir = rirMatch ? parseInt(rirMatch[1], 10) : undefined;

  const set: ImportSet = {};
  if (reps !== undefined) set.reps = reps;
  if (repRange !== undefined) set.repRange = repRange;
  if (weight !== undefined) set.weight = weight;
  if (rir !== undefined) set.rir = rir;

  return Array.from({ length: setCount }, () => ({ ...set }));
}
