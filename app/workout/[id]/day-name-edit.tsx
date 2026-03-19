"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export function DayNameEdit({
  workoutDayId,
  currentName,
}: {
  workoutDayId: string;
  currentName: string | null;
}) {
  const router = useRouter();

  const handleEdit = async () => {
    const name = window.prompt("Day name (e.g. Push, Upper, Legs)", currentName ?? "");
    if (name === null) return;
    const trimmed = name.trim();
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed || null }),
      });
      if (res.ok) router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground -ml-2" onClick={handleEdit}>
      <Pencil className="h-3.5 w-3.5 mr-1" />
      {currentName ? "Edit day name" : "Set day name"}
    </Button>
  );
}
