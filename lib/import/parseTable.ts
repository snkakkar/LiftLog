/**
 * Build ImportProgram from raw rows using a detected column map.
 * Handles: one row per set, one row per exercise (with set columns), and week/day grouping.
 */

import type { ImportProgram, ImportWeek, ImportDay, ImportExercise, ImportSet } from "./types";
import type { ColumnMap } from "./detectLayout";
import {
  getText,
  toNum,
  toWorkingSetCount,
  toWeight,
  toReps,
  toRir,
} from "./normalizeValues";

export interface TableParseOptions {
  programName: string;
  columnMap: ColumnMap;
  rows: (string | number)[][];
}

/** Parse "3x8", "3 x 8", "3 sets 8 reps" into set count and reps. */
function parseSetsReps(text: string): { sets: number; reps: number } | null {
  const t = text.trim().toLowerCase();
  const match = t.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (match) {
    return { sets: parseInt(match[1], 10), reps: parseInt(match[2], 10) };
  }
  const match2 = t.match(/(\d+)\s*sets?\s*(\d+)\s*reps?/);
  if (match2) {
    return { sets: parseInt(match2[1], 10), reps: parseInt(match2[2], 10) };
  }
  return null;
}

function getCell(row: (string | number)[], col: number): string | number | undefined {
  return row[col];
}

export function parseTableToProgram(options: TableParseOptions): ImportProgram {
  const { programName, columnMap, rows } = options;
  const { headerRowIndex, roles, setColumns } = columnMap;
  const dataStart = headerRowIndex + 1;

  type GroupKey = string;
  const exercisesByGroup = new Map<GroupKey, { week?: number; day?: string; name: string; sets: ImportSet[] }>();

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const exerciseName = roles.exercise != null ? getText(getCell(row, roles.exercise)) : "";
    if (!exerciseName || !exerciseName.trim()) continue;

    const week = roles.week != null ? toNum(getCell(row, roles.week)) : undefined;
    const day = roles.day != null ? getText(getCell(row, roles.day)).trim() : undefined;
    const groupKey = [week ?? "", day ?? "", exerciseName.trim()].join("\t");

    if (setColumns && setColumns.length > 0) {
      const sets: ImportSet[] = [];
      const setIndices = [...new Set(setColumns.map((s) => s.setIndex))].sort((a, b) => a - b);
      for (const si of setIndices) {
        const repsCol = setColumns.find((s) => s.setIndex === si && s.type === "reps");
        const weightCol = setColumns.find((s) => s.setIndex === si && s.type === "weight");
        const reps = repsCol != null ? toReps(getCell(row, repsCol.colIndex)) : undefined;
        const weight = weightCol != null ? toWeight(getCell(row, weightCol.colIndex)) : undefined;
        if (reps !== undefined || weight !== undefined) {
          sets.push({ reps, weight });
        }
      }
      if (sets.length === 0 && roles.sets != null) {
        const setsText = getText(getCell(row, roles.sets));
        const parsed = parseSetsReps(setsText);
        if (parsed) {
          for (let i = 0; i < parsed.sets; i++) {
            sets.push({ reps: parsed.reps });
          }
        }
      }
      if (sets.length > 0 || !roles.reps) {
        const existing = exercisesByGroup.get(groupKey);
        if (existing) {
          existing.sets.push(...sets);
        } else {
          exercisesByGroup.set(groupKey, {
            week,
            day: day || undefined,
            name: exerciseName.trim(),
            sets,
          });
        }
        continue;
      }
    }

    const reps = roles.reps != null ? toReps(getCell(row, roles.reps)) : undefined;
    const weight = roles.weight != null ? toWeight(getCell(row, roles.weight)) : undefined;
    const rir = roles.rir != null ? toRir(getCell(row, roles.rir)) : undefined;
    const setCount = roles.sets != null ? toWorkingSetCount(getCell(row, roles.sets)) : undefined;

    if (reps !== undefined || weight !== undefined || (setCount != null && setCount > 0)) {
      const existing = exercisesByGroup.get(groupKey);
      const newSet: ImportSet = { reps, weight, rir: rir ?? undefined };
      if (setCount != null && setCount > 1 && (reps !== undefined || weight !== undefined)) {
        const sets: ImportSet[] = [];
        for (let i = 0; i < setCount; i++) sets.push({ ...newSet });
        if (existing) {
          existing.sets.push(...sets);
        } else {
          exercisesByGroup.set(groupKey, {
            week,
            day: day || undefined,
            name: exerciseName.trim(),
            sets,
          });
        }
      } else {
        if (existing) {
          existing.sets.push(newSet);
        } else {
          exercisesByGroup.set(groupKey, {
            week,
            day: day || undefined,
            name: exerciseName.trim(),
            sets: [newSet],
          });
        }
      }
    } else if (roles.sets != null) {
      const setsText = getText(getCell(row, roles.sets));
      const parsed = parseSetsReps(setsText);
      if (parsed) {
        const sets: ImportSet[] = [];
        for (let i = 0; i < parsed.sets; i++) {
          sets.push({ reps: parsed.reps });
        }
        const existing = exercisesByGroup.get(groupKey);
        if (existing) {
          existing.sets.push(...sets);
        } else {
          exercisesByGroup.set(groupKey, {
            week,
            day: day || undefined,
            name: exerciseName.trim(),
            sets,
          });
        }
      }
    }
  }

  const groups = Array.from(exercisesByGroup.values()).filter(
    (g) => g.sets.length > 0 || g.name.trim()
  );
  if (groups.length === 0) {
    return { name: programName, weeks: [] };
  }

  const hasWeek = groups.some((g) => g.week != null);
  const hasDay = groups.some((g) => g.day != null);

  if (!hasWeek && !hasDay) {
    const dayNumber = 1;
    const exercises: ImportExercise[] = [];
    const byName = new Map<string, ImportSet[]>();
    for (const g of groups) {
      const list = byName.get(g.name) ?? [];
      list.push(...g.sets);
      byName.set(g.name, list);
    }
    for (const [name, sets] of byName) {
      exercises.push({ name, sets });
    }
    return {
      name: programName,
      weeks: [
        {
          weekNumber: 1,
          days: [{ dayNumber, exercises }],
        },
      ],
    };
  }

  const weekKeys = [...new Set(groups.map((g) => g.week ?? 1))].sort((a, b) => a - b);
  const weeks: ImportWeek[] = [];

  for (const wk of weekKeys) {
    const weekGroups = groups.filter((g) => (g.week ?? 1) === wk);
    const dayLabels = [...new Set(weekGroups.map((g) => (g.day ?? "").toString().trim()).values())].filter(Boolean);
    const days: ImportDay[] = [];
    if (dayLabels.length > 0) {
      dayLabels.forEach((dayName, idx) => {
        const dayGroups = weekGroups.filter((g) => (g.day ?? "").trim() === dayName);
        const byEx = new Map<string, ImportSet[]>();
        for (const g of dayGroups) {
          const list = byEx.get(g.name) ?? [];
          list.push(...g.sets);
          byEx.set(g.name, list);
        }
        const exercises: ImportExercise[] = [];
        for (const [name, sets] of byEx) {
          exercises.push({ name, sets });
        }
        days.push({ dayNumber: idx + 1, name: dayName, exercises });
      });
    } else {
      const byEx = new Map<string, ImportSet[]>();
      for (const g of weekGroups) {
        const list = byEx.get(g.name) ?? [];
        list.push(...g.sets);
        byEx.set(g.name, list);
      }
      const exercises: ImportExercise[] = [];
      for (const [name, sets] of byEx) {
        exercises.push({ name, sets });
      }
      days.push({ dayNumber: 1, exercises });
    }
    weeks.push({ weekNumber: wk, days });
  }

  return { name: programName, weeks };
}
