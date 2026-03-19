/**
 * Exercise data access. Centralizes Prisma queries for exercise-related data.
 */

import { prisma } from "@/lib/db";

/**
 * Returns unique exercise names that have at least one logged set for a user.
 * Used for history navigation (works across programs after import).
 */
export async function getExerciseNamesWithHistory(userId: string): Promise<{ name: string }[]> {
  try {
    const logged = await prisma.loggedSet.findMany({
      where: {
        isWarmup: { not: true },
        workoutSession: { workoutDay: { week: { program: { userId } } } },
      },
      distinct: ["exerciseId"],
      select: { exerciseId: true },
      take: 500,
    });
    const ids = [...new Set(logged.map((l) => l.exerciseId))];
    if (ids.length === 0) return [];
    const exercises = await prisma.exercise.findMany({
      where: { id: { in: ids }, workoutDay: { week: { program: { userId } } } },
      select: { name: true },
    });
    const seen = new Set<string>();
    const unique = exercises.filter((e) => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });
    return unique.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}
