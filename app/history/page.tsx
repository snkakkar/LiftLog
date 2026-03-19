import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { HistoryExerciseList } from "./history-exercise-list";
import { getExerciseNamesWithHistory } from "@/lib/repositories/exercises";
import { getCurrentUserId } from "@/lib/auth";

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
