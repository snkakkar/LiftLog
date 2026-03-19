"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SwipeToDeleteRow } from "@/components/swipe-to-delete";
import { Trash2 } from "lucide-react";

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
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sets = initialSets as SetRecord[];
  const byDate = sets.reduce<Record<string, SetRecord[]>>((acc, s) => {
    const d = s.completedAt.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const handleDeleteSet = async (setId: string) => {
    setDeletingId(setId);
    try {
      const res = await fetch(`/api/logged-sets/${setId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

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
                    <li key={s.id}>
                      <SwipeToDeleteRow
                        onDelete={() => handleDeleteSet(s.id)}
                        disabled={deletingId === s.id}
                        className="rounded-md"
                      >
                        <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 px-2 -mx-2">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hidden md:inline-flex text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                            onClick={() => handleDeleteSet(s.id)}
                            disabled={deletingId === s.id}
                            aria-label="Delete this set"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </SwipeToDeleteRow>
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
