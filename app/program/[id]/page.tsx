import { notFound } from "next/navigation";
import { ProgramActions } from "./program-actions";
import { ProgramWeeksView } from "./program-weeks-view";
import { getProgramById } from "@/lib/repositories/programs";
import { getCurrentUserId } from "@/lib/auth";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) notFound();
  const { id } = await params;
  const program = await getProgramById(id, userId);
  if (!program) notFound();

  const weeks = (program.weeks ?? []).map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    startDate: w.startDate ? w.startDate.toISOString().slice(0, 10) : null,
    days: (w.days ?? []).map((d) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      name: d.name,
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <ProgramActions programId={program.id} programName={program.name} isArchived={!!program.archivedAt} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
          <p className="text-muted-foreground mt-1">
            {weeks.length} week{weeks.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <ProgramWeeksView programId={program.id} weeks={weeks} />
    </div>
  );
}
