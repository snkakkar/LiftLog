/**
 * Program data access. Centralizes Prisma queries for programs with weeks/days.
 */

import { prisma } from "@/lib/db";

const programInclude = {
  weeks: {
    orderBy: { weekNumber: "asc" as const },
    include: { days: { orderBy: { dayNumber: "asc" as const } } },
  },
} as const;

export type ProgramWithWeeksAndDays = Awaited<ReturnType<typeof getProgramsForUser>>[number];

/**
 * Fetch programs for a user with weeks and days included.
 * @param filter "all" = no archive filter, "active" = non-archived only, "archived" = archived only
 */
export async function getProgramsForUser(
  userId: string,
  filter: "all" | "active" | "archived" = "active"
) {
  return prisma.program.findMany({
    where: {
      userId,
      ...(filter === "archived"
        ? { archivedAt: { not: null } }
        : filter === "active"
          ? { archivedAt: null }
          : {}),
    },
    orderBy: { createdAt: "desc" },
    include: programInclude,
  });
}

/**
 * Fetch a single program by id for a user, or null if not found.
 */
export async function getProgramById(id: string, userId: string) {
  return prisma.program.findFirst({
    where: { id, userId },
    include: programInclude,
  });
}
