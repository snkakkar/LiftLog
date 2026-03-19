import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutLogClient } from "./workout-log-client";
import { DayNameEdit } from "./day-name-edit";
import { RestTimer } from "@/components/rest-timer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

async function getWorkoutDay(id: string, userId: string) {
  return prisma.workoutDay.findFirst({
    where: { id, week: { program: { userId } } },
    include: {
      week: { include: { program: true } },
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          templateSets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) notFound();
  const { id } = await params;
  const day = await getWorkoutDay(id, userId);
  if (!day) notFound();

  const programId = day.week?.program?.id ?? null;
  const programName = day.week?.program?.name ?? null;

  let serializedExercises: Parameters<typeof WorkoutLogClient>[0]["exercises"] = [];
  try {
    const raw = JSON.parse(JSON.stringify(day.exercises ?? []));
    serializedExercises = Array.isArray(raw) ? raw : [];
  } catch {
    serializedExercises = [];
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
          <Link href={programId ? `/program/${programId}` : "/"}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {programName ? `Back to ${programName}` : "Back to program"}
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">
          {programName} — Week {day.week?.weekNumber}, Day {day.dayNumber}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {day.name && <p className="text-muted-foreground">{day.name}</p>}
          <DayNameEdit workoutDayId={day.id} currentName={day.name} />
        </div>
      </div>
      <RestTimer />
      <WorkoutLogClient
        workoutDayId={day.id}
        exercises={serializedExercises}
        programId={programId ?? undefined}
        currentWeekNumber={day.week?.weekNumber ?? undefined}
      />
    </div>
  );
}
