import { describe, it, expect } from "vitest";
import {
  buildExerciseBlocks,
  getExerciseBlockKey,
  maxDisplayedSetCount,
  templateForSetNumber,
  type ExerciseLike,
  type TemplateSetLike,
} from "../blocks";

function ex(
  id: string,
  orderIndex: number,
  opts: { supersetGroupId?: string | null; templateSets?: TemplateSetLike[] } = {}
): ExerciseLike {
  return {
    id,
    orderIndex,
    supersetGroupId: opts.supersetGroupId ?? null,
    templateSets: opts.templateSets ?? [],
  };
}

describe("buildExerciseBlocks", () => {
  it("returns empty array for empty input", () => {
    expect(buildExerciseBlocks([])).toEqual([]);
  });

  it("wraps standalone exercises in single blocks, sorted by orderIndex", () => {
    const blocks = buildExerciseBlocks([ex("b", 1), ex("a", 0)]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "single", exercise: ex("a", 0) });
    expect(blocks[1]).toEqual({ type: "single", exercise: ex("b", 1) });
  });

  it("pairs exercises sharing a non-empty supersetGroupId", () => {
    const a = ex("a", 0, { supersetGroupId: "g1" });
    const b = ex("b", 1, { supersetGroupId: "g1" });
    const blocks = buildExerciseBlocks([a, b]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: "superset", first: a, second: b, groupId: "g1" });
  });

  it("orders superset members by orderIndex regardless of input order", () => {
    const later = ex("later", 5, { supersetGroupId: "g1" });
    const earlier = ex("earlier", 2, { supersetGroupId: "g1" });
    const blocks = buildExerciseBlocks([later, earlier]);
    expect(blocks[0]).toMatchObject({ type: "superset", first: earlier, second: later });
  });

  it("falls back to a single block when a group has no partner", () => {
    const lonely = ex("lonely", 0, { supersetGroupId: "g1" });
    const blocks = buildExerciseBlocks([lonely]);
    expect(blocks).toEqual([{ type: "single", exercise: lonely }]);
  });

  it("treats whitespace-only group ids as no group", () => {
    const a = ex("a", 0, { supersetGroupId: "   " });
    const b = ex("b", 1, { supersetGroupId: "   " });
    const blocks = buildExerciseBlocks([a, b]);
    expect(blocks).toEqual([
      { type: "single", exercise: a },
      { type: "single", exercise: b },
    ]);
  });

  it("interleaves singles and supersets in orderIndex order", () => {
    const a = ex("a", 0);
    const b = ex("b", 1, { supersetGroupId: "g" });
    const c = ex("c", 2, { supersetGroupId: "g" });
    const d = ex("d", 3);
    const blocks = buildExerciseBlocks([a, b, c, d]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: "single", exercise: a });
    expect(blocks[1]).toMatchObject({ type: "superset", groupId: "g" });
    expect(blocks[2]).toMatchObject({ type: "single", exercise: d });
  });
});

describe("getExerciseBlockKey", () => {
  it("uses exercise id for single blocks", () => {
    expect(getExerciseBlockKey({ type: "single", exercise: ex("a", 0) })).toBe("a");
  });

  it("namespaces superset keys to avoid collisions with exercise ids", () => {
    const a = ex("a", 0, { supersetGroupId: "g1" });
    const b = ex("b", 1, { supersetGroupId: "g1" });
    expect(getExerciseBlockKey({ type: "superset", first: a, second: b, groupId: "g1" })).toBe(
      "superset:g1"
    );
  });
});

describe("maxDisplayedSetCount", () => {
  const t = (n: number): TemplateSetLike => ({
    id: `t${n}`,
    setNumber: n,
    targetReps: null,
    targetRepsMin: null,
    targetWeight: null,
  });

  it("returns at least 1 even with no templates and no logs", () => {
    const a = ex("a", 0);
    const b = ex("b", 1);
    expect(maxDisplayedSetCount(a, b, [], [])).toBe(1);
  });

  it("uses the larger template count between the two exercises", () => {
    const a = ex("a", 0, { templateSets: [t(1), t(2), t(3)] });
    const b = ex("b", 1, { templateSets: [t(1)] });
    expect(maxDisplayedSetCount(a, b, [], [])).toBe(3);
  });

  it("expands to cover logged sets that exceed template length", () => {
    const a = ex("a", 0, { templateSets: [t(1), t(2)] });
    const b = ex("b", 1, { templateSets: [t(1), t(2)] });
    expect(maxDisplayedSetCount(a, b, [{ setNumber: 5 }], [])).toBe(5);
    expect(maxDisplayedSetCount(a, b, [], [{ setNumber: 4 }])).toBe(4);
  });
});

describe("templateForSetNumber", () => {
  const real: TemplateSetLike = {
    id: "real",
    setNumber: 2,
    targetReps: 10,
    targetRepsMin: 8,
    targetWeight: 135,
    targetRir: 2,
  };

  it("returns the matching template when present", () => {
    const e = ex("a", 0, { templateSets: [real] });
    expect(templateForSetNumber(e, 2)).toBe(real);
  });

  it("synthesizes an empty template with id='' when missing", () => {
    const e = ex("a", 0, { templateSets: [real] });
    const synth = templateForSetNumber(e, 5);
    expect(synth).toEqual({
      id: "",
      setNumber: 5,
      targetReps: null,
      targetRepsMin: null,
      targetWeight: null,
      targetRir: null,
    });
  });
});
