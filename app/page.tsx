import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { getDashboardData } from "@/lib/repositories/dashboard";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return <DashboardClient data={data} />;
}
