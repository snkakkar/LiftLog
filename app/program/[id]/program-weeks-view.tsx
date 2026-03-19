"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Copy, Plus, Trash2, GripVertical, Pencil } from "lucide-react";

type Day = { id: string; dayNumber: number; name: string | null };
type Week = { id: string; weekNumber: number; startDate: string | null; days: Day[] };

function formatWeekDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProgramWeeksView({
  programId,
  weeks,
}: {
  programId: string;
  weeks: Week[];
}) {
  const router = useRouter();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");
  const [dateSaving, setDateSaving] = useState(false);

  const handleDuplicateWeek = async (sourceWeekId: string) => {
    try {
      const res = await fetch(`/api/programs/${programId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWeekId }),
      });
      if (!res.ok) throw new Error("Duplicate failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWeek = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Add week failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDay = async (weekId: string) => {
    try {
      const res = await fetch(`/api/weeks/${weekId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Add day failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWeek = async (weekId: string) => {
    if (!confirm("Delete this week and all its days? Logged data for this week will be removed.")) return;
    try {
      const res = await fetch(`/api/weeks/${weekId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragStart = (e: React.DragEvent, weekId: string) => {
    setDraggedId(weekId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", weekId);
  };
  const handleDragOver = (e: React.DragEvent, weekId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== weekId) setDropTargetId(weekId);
  };
  const handleDragLeave = () => setDropTargetId(null);
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }
    const srcIdx = weeks.findIndex((w) => w.id === sourceId);
    const tgtIdx = weeks.findIndex((w) => w.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) {
      setDraggedId(null);
      return;
    }
    const newOrder = [...weeks];
    const [removed] = newOrder.splice(srcIdx, 1);
    newOrder.splice(tgtIdx, 0, removed);
    try {
      const res = await fetch(`/api/programs/${programId}/weeks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekIds: newOrder.map((w) => w.id) }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
    setDraggedId(null);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  const startEditDate = (w: Week) => {
    setEditingWeekId(w.id);
    setEditDateValue(w.startDate ?? "");
  };
  const cancelEditDate = () => {
    setEditingWeekId(null);
    setEditDateValue("");
  };
  const saveWeekDate = async (weekId: string) => {
    setDateSaving(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: editDateValue.trim() || null }),
      });
      if (res.ok) {
        setEditingWeekId(null);
        setEditDateValue("");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDateSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {weeks.map((w) => (
        <Card
          key={w.id}
          onDragOver={(e) => handleDragOver(e, w.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, w.id)}
          className={`transition-shadow ${dropTargetId === w.id ? "ring-2 ring-primary" : ""}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex items-center gap-1 min-w-0 cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => handleDragStart(e, w.id)}
                  onDragEnd={handleDragEnd}
                >
                  <span className={`text-muted-foreground shrink-0 ${draggedId === w.id ? "opacity-50" : ""}`} aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-lg">Week {w.weekNumber}</CardTitle>
                </div>
                {editingWeekId === w.id ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={editDateValue}
                      onChange={(e) => setEditDateValue(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <Button size="sm" variant="secondary" className="h-8" onClick={cancelEditDate}>
                      Cancel
                    </Button>
                    <Button size="sm" className="h-8" disabled={dateSaving} onClick={() => saveWeekDate(w.id)}>
                      {dateSaving ? "…" : "Save"}
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm shrink-0 flex items-center gap-1">
                    {w.startDate ? (
                      <>
                        {formatWeekDate(w.startDate)}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditDate(w)} aria-label="Edit week date">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => startEditDate(w)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Set date
                      </Button>
                    )}
                  </span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleDuplicateWeek(w.id)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Duplicate week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleAddDay(w.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add day
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteWeek(w.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete week
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {w.days.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No days yet. Add a day to start logging.</p>
            ) : (
              <ul className="space-y-2">
                {w.days.map((d) => (
                  <li key={d.id}>
                    <Button variant="ghost" className="w-full justify-between" asChild>
                      <Link href={`/workout/${d.id}`}>
                        <span>
                          Day {d.dayNumber}
                          {d.name && ` — ${d.name}`}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <Button variant="outline" className="w-full" onClick={handleAddWeek}>
            <Plus className="h-4 w-4 mr-2" />
            Add week
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            New week can be filled with &quot;Add day&quot; on that week, then log which day you&apos;re lifting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
