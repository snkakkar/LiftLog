/**
 * One-time script: Reset the migrated@liftlog.local password to "changeme".
 * Run with: DATABASE_URL="your-neon-url" npx tsx scripts/reset-admin-password.ts
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "migrated@liftlog.local" },
  });
  if (!user) {
    console.log("User migrated@liftlog.local not found. Run: npm run db:seed");
    process.exit(1);
  }
  const passwordHash = await hash("changeme", 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  console.log("Password reset. Sign in with: migrated@liftlog.local / changeme");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
