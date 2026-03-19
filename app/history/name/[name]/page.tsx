import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HistoryDetailClient } from "./history-detail-client";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export default async function ExerciseNameHistoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) notFound();
  const { name: encodedName } = await params;
  const name = decodeURIComponent(encodedName);
  if (!name) notFound();

  const exercises = await prisma.exercise.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      workoutDay: { week: { program: { userId } } },
    },
    select: { id: true },
  });
  const exerciseIds = exercises.map((e) => e.id);
  if (exerciseIds.length === 0) notFound();

  const sets = await prisma.loggedSet.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      isWarmup: { not: true },
      workoutSession: { workoutDay: { week: { program: { userId } } } },
    },
    orderBy: { completedAt: "desc" },
    take: 2000,
    include: {
      exercise: { select: { name: true } },
      workoutSession: {
        include: {
          workoutDay: {
            include: { week: { include: { program: true } } },
          },
        },
      },
    },
  });
  const serializedSets = JSON.parse(JSON.stringify(sets));

  const bodyLogs = await prisma.bodyMetricLog.findMany({
    where: { userId, weightLb: { not: null } },
    orderBy: { date: "asc" },
    select: { date: true, weightLb: true },
    take: 500,
  });
  const serializedBodyLogs = JSON.parse(JSON.stringify(bodyLogs)) as { date: string; weightLb: number | null }[];

  const latestLog = await prisma.bodyMetricLog.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });
  const profile = await prisma.profile.findFirst({ where: { userId } });
  const profileContext =
    latestLog?.weightLb != null || latestLog?.bodyFatPct != null || profile
      ? {
          weightLb: latestLog?.weightLb ?? null,
          bodyFatPct: latestLog?.bodyFatPct ?? null,
          heightCm: profile?.heightCm ?? null,
          age: profile?.age ?? null,
          logDate: latestLog?.date ? new Date(latestLog.date).toISOString().slice(0, 10) : null,
        }
      : null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
        <Link href="/history">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to history
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{name}</h1>
        <p className="text-muted-foreground text-sm">Logged sets (all programs) · progression below</p>
      </div>
      <HistoryDetailClient
        exerciseName={name}
        sets={serializedSets}
        bodyLogs={serializedBodyLogs}
        profileContext={profileContext}
      />
    </div>
  );
}
