import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";

/** Profile has moved to the account menu (click your name/email in the header). */
export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  redirect("/");
}
