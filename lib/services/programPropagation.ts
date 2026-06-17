/**
 * Program propagation service.
 *
 * Programs in this app are denormalized: each Week owns its own copy of WorkoutDay,
 * Exercise, and ExerciseSet. There is no shared "exercise definition" across weeks.
 * That gives the user complete week-by-week flexibility (different sets/weights per
 * week is the norm for periodization), but it means an edit to Week N, Day D does
 * NOT automatically affect Week N+1, Day D.
 *
 * This module provides one-shot propagation operations that walk forward from a
 * source day to subsequent weeks' matching dayNumber and apply a structural change.
 *
 * Invariants enforced by every operation:
 *   - Only weeks with weekNumber > source week are touched.
 *   - Days that already have logged sets are skipped (do not mutate completed history).
 *   - Exercise matching across weeks is by case-insensitive name (the same convention
 *     the rest of the app uses for cross-week lookups).
 *   - Auth must be checked by the caller (we trust the userId passed in).
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export type PropagateInput =
  | { kind: "templateSets"; exerciseId?: string }
  | { kind: "rename"; oldName: string; newName: string }
  | { kind: "exerciseOrder"; orderedExerciseIds: string[] }
  | { kind: "supersetPair"; supersetGroupId: string }
  | { kind: "supersetClear"; exerciseId: string }
  | { kind: "addExercise"; exerciseId: string }
  | { kind: "moveToDay"; exerciseName: string; toDayNumber: number };

export type PropagateResult =
  | { ok: true; updatedWeeks: number }
  | { ok: false; status: number; error: string };

type SourceDay = NonNullable<Awaited<ReturnType<typeof loadSourceDay>>>;

async function loadSourceDay(workoutDayId: string, userId: string) {
  return prisma.workoutDay.findFirst({
    where: { id: workoutDayId, week: { program: { userId } } },
    include: {
      week: true,
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: { templateSets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
}

async function loadTargetDays(sourceDay: SourceDay) {
  return prisma.week.findMany({
    where: {
      programId: sourceDay.week.programId,
      weekNumber: { gt: sourceDay.week.weekNumber },
    },
    orderBy: { weekNumber: "asc" },
    include: {
      days: {
        where: { dayNumber: sourceDay.dayNumber },
        include: {
          exercises: {
            orderBy: { orderIndex: "asc" },
            include: { templateSets: { orderBy: { setNumber: "asc" } } },
          },
          sessions: { include: { loggedSets: { take: 1 } } },
        },
      },
    },
  });
}

function dayHasLoggedSets(day: { sessions: { loggedSets: unknown[] }[] }): boolean {
  return day.sessions.some((s) => s.loggedSets.length > 0);
}

function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const target = name.toLowerCase();
  return list.find((e) => e.name.toLowerCase() === target);
}

export async function propagate(
  workoutDayId: string,
  userId: string,
  input: PropagateInput
): Promise<PropagateResult> {
  const sourceDay = await loadSourceDay(workoutDayId, userId);
  if (!sourceDay) return { ok: false, status: 404, error: "Workout day not found" };

  const subsequentWeeks = await loadTargetDays(sourceDay);

  switch (input.kind) {
    case "supersetPair":
      return propagateSupersetPair(sourceDay, subsequentWeeks, input.supersetGroupId);
    case "supersetClear":
      return propagateSupersetClear(sourceDay, subsequentWeeks, input.exerciseId);
    case "rename":
      return propagateRename(subsequentWeeks, input.oldName, input.newName);
    case "exerciseOrder":
      return propagateOrder(sourceDay, subsequentWeeks, input.orderedExerciseIds);
    case "templateSets":
      return propagateTemplateSets(sourceDay, subsequentWeeks, input.exerciseId);
    case "addExercise":
      return propagateAddExercise(sourceDay, subsequentWeeks, input.exerciseId);
    case "moveToDay":
      return propagateMoveToDay(sourceDay, userId, input.exerciseName, input.toDayNumber);
  }
}

async function propagateSupersetPair(
  sourceDay: SourceDay,
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  groupId: string
): Promise<PropagateResult> {
  const paired = sourceDay.exercises.filter((e) => e.supersetGroupId === groupId);
  if (paired.length !== 2) {
    return { ok: false, status: 404, error: "Superset pair not found on source day" };
  }
  const [srcA, srcB] = paired;

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;

    const tgtA = findByName(targetDay.exercises, srcA.name);
    const tgtB = findByName(targetDay.exercises, srcB.name);
    if (!tgtA || !tgtB) continue;

    const groupsToClear = new Set(
      [tgtA.supersetGroupId, tgtB.supersetGroupId].filter((g): g is string => Boolean(g))
    );
    for (const oldGid of groupsToClear) {
      await prisma.exercise.updateMany({
        where: { workoutDayId: targetDay.id, supersetGroupId: oldGid },
        data: { supersetGroupId: null },
      });
    }

    const newGroupId = randomUUID();
    await prisma.exercise.update({ where: { id: tgtA.id }, data: { supersetGroupId: newGroupId } });
    await prisma.exercise.update({ where: { id: tgtB.id }, data: { supersetGroupId: newGroupId } });
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

async function propagateSupersetClear(
  sourceDay: SourceDay,
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  exerciseId: string
): Promise<PropagateResult> {
  const srcEx = sourceDay.exercises.find((e) => e.id === exerciseId);
  if (!srcEx) return { ok: false, status: 404, error: "Exercise not found on source day" };

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;

    const tgtEx = findByName(targetDay.exercises, srcEx.name);
    if (!tgtEx?.supersetGroupId) continue;

    await prisma.exercise.updateMany({
      where: { workoutDayId: targetDay.id, supersetGroupId: tgtEx.supersetGroupId },
      data: { supersetGroupId: null },
    });
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

async function propagateRename(
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  oldName: string,
  newName: string
): Promise<PropagateResult> {
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, status: 400, error: "newName must be non-empty" };

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;
    const tgtEx = findByName(targetDay.exercises, oldName);
    if (!tgtEx) continue;

    const templateSets = tgtEx.templateSets;
    const created = await prisma.exercise.create({
      data: {
        workoutDayId: targetDay.id,
        name: trimmed,
        orderIndex: tgtEx.orderIndex,
        substitution1: tgtEx.substitution1,
        substitution2: tgtEx.substitution2,
        supersetGroupId: tgtEx.supersetGroupId,
      },
    });
    if (templateSets.length > 0) {
      await prisma.exerciseSet.createMany({
        data: templateSets.map((s) => ({
          exerciseId: created.id,
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetRepsMin: s.targetRepsMin,
          targetWeight: s.targetWeight,
          targetRir: s.targetRir,
        })),
      });
    } else {
      await prisma.exerciseSet.create({
        data: {
          exerciseId: created.id,
          setNumber: 1,
          targetReps: null,
          targetWeight: null,
          targetRir: null,
        },
      });
    }
    await prisma.exercise.delete({ where: { id: tgtEx.id } });
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

/**
 * Reorder exercises in subsequent weeks to match the source day's new order.
 * Uses name-matching: the source day must be passed in its already-reordered state
 * (since the route reads it after the order has been persisted on the source).
 *
 * `orderedExerciseIds` is the source day's new order (used to validate the source state).
 * For each subsequent week, we look up exercises by name and reassign orderIndex
 * to match the source's new sequence. Exercises in the target day that don't exist
 * on the source day are pushed to the end, preserving their relative order.
 */
async function propagateOrder(
  sourceDay: SourceDay,
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  orderedExerciseIds: string[]
): Promise<PropagateResult> {
  const sourceById = new Map(sourceDay.exercises.map((e) => [e.id, e]));
  const sourceOrderedNames = orderedExerciseIds
    .map((id) => sourceById.get(id)?.name)
    .filter((n): n is string => typeof n === "string");

  if (sourceOrderedNames.length === 0) {
    return { ok: false, status: 400, error: "No matching exercises in orderedExerciseIds" };
  }

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;

    const targetByName = new Map<string, typeof targetDay.exercises[number]>();
    for (const ex of targetDay.exercises) {
      targetByName.set(ex.name.toLowerCase(), ex);
    }

    const newSequence: typeof targetDay.exercises = [];
    const usedIds = new Set<string>();
    for (const name of sourceOrderedNames) {
      const tgtEx = targetByName.get(name.toLowerCase());
      if (tgtEx && !usedIds.has(tgtEx.id)) {
        newSequence.push(tgtEx);
        usedIds.add(tgtEx.id);
      }
    }
    // Append exercises that exist on this day but not on source, preserving relative order
    for (const ex of targetDay.exercises) {
      if (!usedIds.has(ex.id)) newSequence.push(ex);
    }

    if (newSequence.length === 0) continue;
    await Promise.all(
      newSequence.map((ex, i) =>
        prisma.exercise.update({ where: { id: ex.id }, data: { orderIndex: i } })
      )
    );
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

/**
 * Add a copy of `exerciseId` from the source day to every subsequent week's matching dayNumber.
 *
 * Semantics:
 *   - Skips target days that already have an exercise with the same name (idempotent;
 *     re-running won't create duplicates).
 *   - Skips target days that already have logged sets (don't mutate completed history).
 *   - Copies name, substitutions, and template sets. Does NOT carry over supersetGroupId —
 *     each week owns its own pairings.
 *   - Appends at the end of the target day (orderIndex = max + 1). The user can use the
 *     "exerciseOrder" propagate flow afterward if they want a specific position.
 */
async function propagateAddExercise(
  sourceDay: SourceDay,
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  exerciseId: string
): Promise<PropagateResult> {
  const srcEx = sourceDay.exercises.find((e) => e.id === exerciseId);
  if (!srcEx) return { ok: false, status: 404, error: "Exercise not found on source day" };

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;
    if (findByName(targetDay.exercises, srcEx.name)) continue;

    const nextOrderIndex = targetDay.exercises.length > 0
      ? Math.max(...targetDay.exercises.map((e) => e.orderIndex)) + 1
      : 0;

    const created = await prisma.exercise.create({
      data: {
        workoutDayId: targetDay.id,
        name: srcEx.name,
        orderIndex: nextOrderIndex,
        substitution1: srcEx.substitution1,
        substitution2: srcEx.substitution2,
      },
    });

    if (srcEx.templateSets.length > 0) {
      await prisma.exerciseSet.createMany({
        data: srcEx.templateSets.map((s) => ({
          exerciseId: created.id,
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetRepsMin: s.targetRepsMin,
          targetWeight: s.targetWeight,
          targetRir: s.targetRir,
        })),
      });
    } else {
      // Mirror /api/workout-day/[id]/exercises POST behavior — every exercise has at least one set row
      await prisma.exerciseSet.create({
        data: {
          exerciseId: created.id,
          setNumber: 1,
          targetReps: null,
          targetWeight: null,
          targetRir: null,
        },
      });
    }
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

async function propagateTemplateSets(
  sourceDay: SourceDay,
  weeks: Awaited<ReturnType<typeof loadTargetDays>>,
  filterExerciseId: string | undefined
): Promise<PropagateResult> {
  const sourceExercises = filterExerciseId
    ? sourceDay.exercises.filter((e) => e.id === filterExerciseId)
    : sourceDay.exercises;

  if (sourceExercises.length === 0) {
    return { ok: false, status: 404, error: "No matching exercises found" };
  }

  let updatedWeeks = 0;
  for (const week of weeks) {
    const targetDay = week.days[0];
    if (!targetDay) continue;
    if (dayHasLoggedSets(targetDay)) continue;

    for (const srcEx of sourceExercises) {
      const tgtEx = findByName(targetDay.exercises, srcEx.name);
      if (!tgtEx) continue;

      await prisma.exerciseSet.deleteMany({ where: { exerciseId: tgtEx.id } });

      if (srcEx.templateSets.length > 0) {
        await prisma.exerciseSet.createMany({
          data: srcEx.templateSets.map((s) => ({
            exerciseId: tgtEx.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetRepsMin: s.targetRepsMin,
            targetWeight: s.targetWeight,
            targetRir: s.targetRir,
          })),
        });
      }
    }
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}

/**
 * Move the exercise (matched by case-insensitive name) from the source day's dayNumber
 * to a different dayNumber in every subsequent week.
 *
 * Semantics:
 *   - The source-week move has already happened (the API endpoint that runs first updates
 *     `exercise.workoutDayId`). This function only walks future weeks.
 *   - For each subsequent week, requires both the "from" day (= source's dayNumber) and the
 *     "to" day (= toDayNumber) to exist. Skips the week otherwise.
 *   - Skips a week if either the from-day or the to-day already has logged sets — moving
 *     would restructure a completed workout.
 *   - On success, the moved exercise is appended to the to-day (orderIndex = max + 1) and
 *     its supersetGroupId is cleared. If it had a partner, the partner's group is also
 *     cleared so the orphaned partner becomes a standalone exercise.
 *   - The user can re-run the "exerciseOrder" propagation afterward to position it.
 */
async function propagateMoveToDay(
  sourceDay: SourceDay,
  userId: string,
  exerciseName: string,
  toDayNumber: number
): Promise<PropagateResult> {
  if (toDayNumber === sourceDay.dayNumber) {
    return { ok: false, status: 400, error: "toDayNumber must differ from source dayNumber" };
  }

  const weeks = await prisma.week.findMany({
    where: {
      programId: sourceDay.week.programId,
      weekNumber: { gt: sourceDay.week.weekNumber },
      program: { userId },
    },
    orderBy: { weekNumber: "asc" },
    include: {
      days: {
        where: { dayNumber: { in: [sourceDay.dayNumber, toDayNumber] } },
        include: {
          exercises: { orderBy: { orderIndex: "asc" } },
          sessions: { include: { loggedSets: { take: 1 } } },
        },
      },
    },
  });

  let updatedWeeks = 0;
  for (const week of weeks) {
    const fromDay = week.days.find((d) => d.dayNumber === sourceDay.dayNumber);
    const toDay = week.days.find((d) => d.dayNumber === toDayNumber);
    if (!fromDay || !toDay) continue;
    if (dayHasLoggedSets(fromDay) || dayHasLoggedSets(toDay)) continue;

    const tgtEx = findByName(fromDay.exercises, exerciseName);
    if (!tgtEx) continue;

    if (tgtEx.supersetGroupId) {
      await prisma.exercise.updateMany({
        where: {
          workoutDayId: fromDay.id,
          supersetGroupId: tgtEx.supersetGroupId,
          id: { not: tgtEx.id },
        },
        data: { supersetGroupId: null },
      });
    }

    const nextOrderIndex = toDay.exercises.length > 0
      ? Math.max(...toDay.exercises.map((e) => e.orderIndex)) + 1
      : 0;

    await prisma.exercise.update({
      where: { id: tgtEx.id },
      data: {
        workoutDayId: toDay.id,
        orderIndex: nextOrderIndex,
        supersetGroupId: null,
      },
    });
    updatedWeeks++;
  }
  return { ok: true, updatedWeeks };
}
