/**
 * One-time seed for multi-user migration: creates a default user and assigns all
 * existing Program, Profile, and BodyMetricLog rows to that user.
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Users already exist, skipping seed.");
    return;
  }

  const passwordHash = await hash("changeme", 12);
  const defaultUser = await prisma.user.create({
    data: {
      email: "migrated@liftlog.local",
      name: "Migrated User",
      passwordHash,
    },
  });

  const [programs, profiles, bodyLogs] = await Promise.all([
    prisma.program.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.profile.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
    prisma.bodyMetricLog.updateMany({ where: { userId: null }, data: { userId: defaultUser.id } }),
  ]);

  console.log(
    `Created default user ${defaultUser.email}. Assigned: ${programs.count} programs, ${profiles.count} profiles, ${bodyLogs.count} body log entries.`
  );
  console.log("Sign in with email: migrated@liftlog.local, password: changeme (change after first login).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
