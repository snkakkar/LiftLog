"use client";

import { Card, CardContent } from "@/components/ui/card";

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SetRecord = {
  id: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  completedAt: string;
  exercise?: { name: string };
  workoutSession?: {
    workoutDay?: {
      week?: { program?: { name: string }; weekNumber: number };
      dayNumber: number;
    };
  };
};

export function HistoryClient({
  exerciseId,
  initialSets,
}: {
  exerciseId: string;
  initialSets: SetRecord[];
}) {
  const sets = initialSets as SetRecord[];
  const byDate = sets.reduce<Record<string, SetRecord[]>>((acc, s) => {
    const d = s.completedAt.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <Card>
      <CardContent className="p-4">
        <ul className="space-y-4">
          {dates.map((date) => (
            <li key={date}>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {formatDate(date)}
              </p>
              <ul className="space-y-1">
                {byDate[date]
                  .sort((a, b) => a.setNumber - b.setNumber)
                  .map((s) => (
                    <li key={s.id} className="text-sm flex gap-2">
                      <span className="text-muted-foreground">Set {s.setNumber}</span>
                      <span>
                        {s.reps ?? "—"}×{s.weight ?? "—"} lb
                        {s.rir != null ? ` RIR${s.rir}` : ""}
                      </span>
                      {s.workoutSession?.workoutDay?.week?.program?.name && (
                        <span className="text-muted-foreground truncate">
                          · {s.workoutSession.workoutDay.week.program.name}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
