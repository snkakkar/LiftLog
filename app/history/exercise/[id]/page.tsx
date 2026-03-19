import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HistoryClient } from "./history-client";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) notFound();
  const { id } = await params;
  const exercise = await prisma.exercise.findFirst({
    where: { id, workoutDay: { week: { program: { userId } } } },
    select: { name: true },
  });
  if (!exercise) notFound();
  const sets = await prisma.loggedSet.findMany({
    where: {
      exerciseId: id,
      isWarmup: { not: true },
      workoutSession: { workoutDay: { week: { program: { userId } } } },
    },
    orderBy: { completedAt: "desc" },
    take: 100,
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
  const exerciseName = exercise.name;
  // Serialize so client receives plain objects (Date -> ISO string)
  const serializedSets = JSON.parse(JSON.stringify(sets));

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
        <Link href="/history">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to history
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{exerciseName}</h1>
        <p className="text-muted-foreground text-sm">Logged sets (newest first)</p>
      </div>
      <HistoryClient exerciseId={id} initialSets={serializedSets} />
    </div>
  );
}
