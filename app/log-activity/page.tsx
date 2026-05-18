import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { listActivitiesForUser } from "@/lib/repositories/activity";
import { LogActivityClient } from "./log-activity-client";

export default async function LogActivityPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const recent = await listActivitiesForUser(userId, 20);
  const serialized = JSON.parse(JSON.stringify(recent)) as {
    id: string;
    kind: string;
    name: string;
    startedAt: string;
    durationMin: number | null;
    distanceMi: number | null;
    caloriesBurned: number | null;
    rpe: number | null;
    note: string | null;
  }[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log activity</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track training that isn&apos;t part of a program — travel HIIT, long walks, conditioning.
          Counts toward your consistency and intensity score.
        </p>
      </div>
      <LogActivityClient recent={serialized} />
    </div>
  );
}
