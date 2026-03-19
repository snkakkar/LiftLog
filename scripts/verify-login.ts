/**
 * Verify that migrated@liftlog.local can authenticate against the DB.
 * Run with: DATABASE_URL="your-neon-url" npx tsx scripts/verify-login.ts
 */
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "migrated@liftlog.local";
  const password = "changeme";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("❌ User not found. Run: npm run db:seed");
    process.exit(1);
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    console.log("❌ Password mismatch. Run: npx tsx scripts/reset-admin-password.ts");
    process.exit(1);
  }

  console.log("✅ Login works! User exists and password is correct.");
  console.log("   If Vercel login still fails, check NEXTAUTH_URL and redeploy.");
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
