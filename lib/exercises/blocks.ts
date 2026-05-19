/**
 * Block-layout helpers for the workout-log UI. Pure functions, no React or
 * Prisma dependencies — they take structural inputs so they can be unit-tested
 * and reused without coupling to the client component's full Exercise/LoggedSet
 * shapes.
 */

export type TemplateSetLike = {
  id: string;
  setNumber: number;
  targetReps: number | null;
  targetRepsMin: number | null;
  targetWeight: number | null;
  targetRir?: number | null;
};

export type ExerciseLike = {
  id: string;
  orderIndex: number;
  templateSets: TemplateSetLike[];
  supersetGroupId?: string | null;
};

export type LoggedSetLike = {
  setNumber: number;
};

export type ExerciseBlock<E extends ExerciseLike = ExerciseLike> =
  | { type: "single"; exercise: E }
  | { type: "superset"; first: E; second: E; groupId: string };

/**
 * Group exercises into blocks: standalone exercises become "single" blocks,
 * pairs sharing a non-empty `supersetGroupId` become a "superset" block with
 * `first`/`second` ordered by `orderIndex`. An exercise whose group id has no
 * partner falls back to a single block.
 */
export function buildExerciseBlocks<E extends ExerciseLike>(exercises: E[]): ExerciseBlock<E>[] {
  const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  const used = new Set<string>();
  const blocks: ExerciseBlock<E>[] = [];
  for (const ex of sorted) {
    if (used.has(ex.id)) continue;
    const gid = ex.supersetGroupId?.trim();
    if (gid) {
      const partner = sorted.find((p) => p.id !== ex.id && p.supersetGroupId === gid);
      if (partner) {
        used.add(ex.id);
        used.add(partner.id);
        const [first, second] =
          ex.orderIndex <= partner.orderIndex ? [ex, partner] : [partner, ex];
        blocks.push({ type: "superset", first, second, groupId: gid });
        continue;
      }
    }
    blocks.push({ type: "single", exercise: ex });
  }
  return blocks;
}

/** Stable identity for an ExerciseBlock — used as a React key and expand/collapse id. */
export function getExerciseBlockKey<E extends ExerciseLike>(block: ExerciseBlock<E>): string {
  return block.type === "single" ? block.exercise.id : `superset:${block.groupId}`;
}

/**
 * How many set rows to render for a superset, considering both exercises'
 * template sets and any logged sets that exceed the template length. Always
 * returns at least 1 so an empty block still renders an input row.
 */
export function maxDisplayedSetCount<E extends ExerciseLike, L extends LoggedSetLike>(
  a: E,
  b: E,
  loggedA: L[],
  loggedB: L[]
): number {
  const tmplMax = Math.max(
    Array.isArray(a.templateSets) ? a.templateSets.length : 0,
    Array.isArray(b.templateSets) ? b.templateSets.length : 0,
    1
  );
  const logA = loggedA.length ? Math.max(...loggedA.map((s) => s.setNumber)) : 0;
  const logB = loggedB.length ? Math.max(...loggedB.map((s) => s.setNumber)) : 0;
  return Math.max(tmplMax, logA, logB, 1);
}

/**
 * Look up the template set for a given setNumber, or synthesize an empty
 * template if none exists. Synthesized templates have an empty `id` so callers
 * can detect them.
 */
export function templateForSetNumber<E extends ExerciseLike>(
  ex: E,
  setNumber: number
): TemplateSetLike {
  const list = Array.isArray(ex.templateSets) ? ex.templateSets : [];
  const found = list.find((s) => s.setNumber === setNumber);
  if (found) return found;
  return {
    id: "",
    setNumber,
    targetReps: null,
    targetRepsMin: null,
    targetWeight: null,
    targetRir: null,
  };
}
