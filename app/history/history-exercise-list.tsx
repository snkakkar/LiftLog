"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function HistoryExerciseList({ exercises }: { exercises: { name: string }[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search exercises..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search exercises"
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {filtered.map((ex) => (
          <li key={ex.name}>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href={`/history/name/${encodeURIComponent(ex.name)}`}>
                {ex.name}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {query.trim() ? "No exercises match your search." : "No exercises yet."}
        </p>
      )}
    </div>
  );
}
