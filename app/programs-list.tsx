import { ProgramCard } from "./program-card";

type Program = {
  id: string;
  name: string;
  weeks?: { days?: unknown[] }[];
};

export function ProgramsList({ programs }: { programs: Program[] }) {
  if (programs.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {programs.map((p) => (
        <li key={p.id}>
          <ProgramCard program={p} />
        </li>
      ))}
    </ul>
  );
}
