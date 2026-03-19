import { ensureAdminPage } from "@/lib/auth";
import { AdminDashboard } from "./admin-dashboard";

export default async function AdminPage() {
  await ensureAdminPage();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          User stats and account creation. Only admins can access this page.
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
