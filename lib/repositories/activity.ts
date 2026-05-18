/**
 * ActivitySession data access. Standalone training that isn't tied to a Program —
 * cardio, walks, travel HIIT, mobility work. Powers consistency + intensity
 * components of the dashboard score.
 */

import { prisma } from "@/lib/db";

export const ACTIVITY_KINDS = ["cardio", "strength", "hiit", "walk", "mobility", "other"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface CreateActivityInput {
  kind: ActivityKind;
  name: string;
  startedAt?: Date | null;
  durationMin?: number | null;
  distanceMi?: number | null;
  rpe?: number | null;
  note?: string | null;
}

export async function createActivity(userId: string, input: CreateActivityInput) {
  return prisma.activitySession.create({
    data: {
      userId,
      kind: input.kind,
      name: input.name.trim(),
      startedAt: input.startedAt ?? new Date(),
      durationMin: input.durationMin ?? null,
      distanceMi: input.distanceMi ?? null,
      rpe: input.rpe ?? null,
      note: input.note?.trim() || null,
    },
  });
}

export async function listActivitiesForUser(userId: string, limit = 50) {
  return prisma.activitySession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function deleteActivity(userId: string, id: string) {
  // Use deleteMany with userId guard so we can't accidentally delete another user's row.
  return prisma.activitySession.deleteMany({ where: { id, userId } });
}
