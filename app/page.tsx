import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, Plus, Archive, AlertCircle } from "lucide-react";
import { ProgramsList } from "./programs-list";
import { CreateProgramButton } from "./create-program-button";
import { getProgramsForUser } from "@/lib/repositories/programs";
import { getCurrentUserId } from "@/lib/auth";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  let programs: Awaited<ReturnType<typeof getProgramsForUser>> = [];
  let archivedPrograms: Awaited<ReturnType<typeof getProgramsForUser>> = [];
  let loadError: string | null = null;

  try {
    const all = await getProgramsForUser(userId, "all");
    programs = all.filter((p) => !p.archivedAt);
    archivedPrograms = all.filter((p) => p.archivedAt);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load programs";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Programs</h1>
        <div className="flex flex-wrap gap-2">
          <CreateProgramButton />
          <Button asChild>
            <Link href="/import">
              <Plus className="h-4 w-4" />
              Import program
            </Link>
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {programs.length === 0 && archivedPrograms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No programs yet</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create a program from scratch or upload an Excel workout to get started.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <CreateProgramButton />
              <Button asChild>
                <Link href="/import">Import program</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {programs.length > 0 && <ProgramsList programs={programs} />}
          {archivedPrograms.length > 0 && (
            <div className="pt-6 border-t border-border">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archived
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {archivedPrograms.map((p: { id: string; name: string }) => (
                  <li key={p.id}>
                    <Link href={`/program/${p.id}`}>
                      <Card className="transition-colors hover:bg-muted/50 opacity-75">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{p.name}</CardTitle>
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
