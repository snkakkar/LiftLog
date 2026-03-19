import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const profile = await prisma.profile.findFirst({ where: { userId } });
  const dailyLogs = await prisma.bodyMetricLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 90,
  });
  const serializedLogs = JSON.parse(JSON.stringify(dailyLogs));
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Your stats and daily body log for context in summaries.
        </p>
      </div>
      <ProfileClient
        initialProfile={profile ? { heightCm: profile.heightCm, age: profile.age, gender: profile.gender } : null}
        initialDailyLogs={serializedLogs}
      />
    </div>
  );
}
