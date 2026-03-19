import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { HistoryExerciseList } from "./history-exercise-list";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

/** Returns unique exercise names that have at least one logged set (so history works after uploading a new program). */
async function getExerciseNamesWithHistory(userId: string): Promise<{ name: string }[]> {
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

export default async function HistoryPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const byName = await getExerciseNamesWithHistory(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exercise history</h1>
        <p className="text-muted-foreground mt-1">
          View past performance by exercise (all programs).
        </p>
      </div>

      {byName.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No logged sets yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Log sets in a workout to see history here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <HistoryExerciseList exercises={byName} />
      )}
    </div>
  );
}
