"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, ChevronUp, Replace, Minus, Plus, GripVertical, Check, Trash2, ArrowRightCircle, History } from "lucide-react";

type TemplateSet = {
  id: string;
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  targetRir?: number | null;
};
type Exercise = {
  id: string;
  name: string;
  orderIndex: number;
  templateSets: TemplateSet[];
  substitution1?: string | null;
  substitution2?: string | null;
};
type LoggedSet = {
  id: string;
  exerciseId?: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  completedAt: string;
};
type PreviousLog = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  completedAt: string;
}[];

function repRangeLabel(targetReps: number | null): string {
  if (targetReps == null || targetReps < 1) return "";
  const low = Math.max(1, targetReps - 2);
  return low === targetReps ? `${targetReps} reps` : `${low}–${targetReps} reps`;
}

/** Epley 1RM estimate: weight * (1 + reps/30). Returns null if invalid. */
function epley1RM(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

export function WorkoutLogClient({
  workoutDayId,
  exercises: exercisesProp,
  programId,
  currentWeekNumber,
}: {
  workoutDayId: string;
  exercises: Exercise[];
  programId?: string;
  currentWeekNumber?: number;
}) {
  const exercises = Array.isArray(exercisesProp) ? exercisesProp : [];
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [setDragId, setSetDragId] = useState<string | null>(null);
  const [setDropTargetId, setSetDropTargetId] = useState<string | null>(null);
  const [exDragId, setExDragId] = useState<string | null>(null);
  const [exDropTargetId, setExDropTargetId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [loggedByExercise, setLoggedByExercise] = useState<Record<string, LoggedSet[]>>({});
  const [previousByExercise, setPreviousByExercise] = useState<Record<string, PreviousLog>>({});
  const [overridesByExercise, setOverridesByExercise] = useState<Record<string, string>>({});
  const [expandedExercise, setExpandedExercise] = useState<string | null>(exercises[0]?.id ?? null);
  const [customReplaceExId, setCustomReplaceExId] = useState<string | null>(null);
  const [customReplaceValue, setCustomReplaceValue] = useState("");
  const [recommendationByEx, setRecommendationByEx] = useState<Record<string, string | null>>({});
  const [addExerciseName, setAddExerciseName] = useState("");
  const [addExerciseLoading, setAddExerciseLoading] = useState(false);
  const [programDays, setProgramDays] = useState<{ id: string; weekNumber: number; dayNumber: number; name: string | null }[] | null>(null);
  const [deletingExId, setDeletingExId] = useState<string | null>(null);
  const [movingExId, setMovingExId] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    const existingRes = await fetch(
      `/api/sessions/by-day?workoutDayId=${encodeURIComponent(workoutDayId)}`
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      if (existing?.id) {
        setSessionId(existing.id);
        const [setsRes, overridesRes] = await Promise.all([
          fetch(`/api/sessions/${existing.id}/sets`),
          fetch(`/api/sessions/${existing.id}/overrides`),
        ]);
        if (setsRes.ok) {
          const sets = (await setsRes.json()) as (LoggedSet & { exerciseId?: string })[];
          const byEx: Record<string, LoggedSet[]> = {};
          for (const s of sets) {
            const eid = s.exerciseId ?? "";
            if (!eid) continue;
            if (!byEx[eid]) byEx[eid] = [];
            byEx[eid].push(s);
          }
          setLoggedByExercise(byEx);
        }
        if (overridesRes.ok) {
          const list = (await overridesRes.json()) as { exerciseId: string; displayName: string }[];
          const overrides: Record<string, string> = {};
          list.forEach((o) => {
            overrides[o.exerciseId] = o.displayName;
          });
          setOverridesByExercise(overrides);
        }
        return existing.id;
      }
    }
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutDayId }),
    });
    if (!res.ok) throw new Error("Failed to create session");
    const data = await res.json();
    setSessionId(data.id);
    return data.id;
  }, [workoutDayId]);

  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSession(false);
      }
    })();
  }, [ensureSession]);

  useEffect(() => {
    if (!programId) return;
    fetch(`/api/programs/${programId}/days`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { days?: { id: string; weekNumber: number; dayNumber: number; name: string | null }[] } | null) => {
        if (data?.days) setProgramDays(data.days);
      })
      .catch(() => {});
  }, [programId]);

  useEffect(() => {
    exercises.forEach((ex) => {
      const id = ex?.id;
      if (!id) return;
      const params = new URLSearchParams({ exerciseId: id });
      if (ex.name?.trim()) params.set("exerciseName", ex.name.trim());
      if (programId) params.set("programId", programId);
      if (currentWeekNumber != null) params.set("currentWeekNumber", String(currentWeekNumber));
      fetch(`/api/previous-log?${params}`)
        .then((r) => r.json())
        .then((sets: { setNumber: number; reps: number | null; weight: number | null; rir: number | null; completedAt: string }[]) => {
          setPreviousByExercise((prev) => ({
            ...prev,
            [id]: sets.map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weight: s.weight,
              rir: s.rir,
              completedAt: s.completedAt,
            })),
          }));
        })
        .catch(() => {});
    });
  }, [exercises, programId, currentWeekNumber]);

  useEffect(() => {
    if (!expandedExercise) return;
    const ex = exercises.find((e) => e.id === expandedExercise);
    if (!ex || recommendationByEx[ex.id] !== undefined) return;
    const recParams = new URLSearchParams();
    if (programId) recParams.set("programId", programId);
    if (currentWeekNumber != null) recParams.set("currentWeekNumber", String(currentWeekNumber));
    fetch(`/api/exercises/${ex.id}/recommendation?${recParams}`)
      .then((r) => r.json())
      .then((data: { suggestion?: string | null }) =>
        setRecommendationByEx((prev) => ({ ...prev, [ex.id]: data.suggestion ?? null }))
      )
      .catch(() => setRecommendationByEx((prev) => ({ ...prev, [ex.id]: null })));
  }, [expandedExercise, exercises, recommendationByEx, programId, currentWeekNumber]);

  async function setExerciseDisplay(exId: string, displayName: string | null) {
    if (!sessionId) return;
    if (displayName === null || displayName.trim() === "") {
      await fetch(`/api/sessions/${sessionId}/overrides?exerciseId=${encodeURIComponent(exId)}`, {
        method: "DELETE",
      });
      setOverridesByExercise((prev) => {
        const next = { ...prev };
        delete next[exId];
        return next;
      });
    } else {
      const res = await fetch(`/api/sessions/${sessionId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: exId, displayName: displayName.trim() }),
      });
      if (!res.ok) return;
      setOverridesByExercise((prev) => ({ ...prev, [exId]: displayName.trim() }));
    }
    setCustomReplaceExId(null);
    setCustomReplaceValue("");
    setLastSavedAt(new Date());
  }

  async function logSet(
    exerciseId: string,
    setNumber: number,
    payload: { reps?: number; weight?: number; rir?: number; isWarmup?: boolean }
  ) {
    if (!sessionId) return;
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workoutSessionId: sessionId,
        exerciseId,
        setNumber,
        reps: payload.reps ?? null,
        weight: payload.weight ?? null,
        rir: payload.rir ?? null,
        isWarmup: payload.isWarmup === true,
      }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setLoggedByExercise((prev) => {
      const list = prev[exerciseId] ?? [];
      const without = list.filter((s) => s.setNumber !== setNumber);
      return { ...prev, [exerciseId]: [...without, created].sort((a, b) => a.setNumber - b.setNumber) };
    });
    setLastSavedAt(new Date());
  }

  async function handleAddSet(exerciseId: string) {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Add set failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  }

  function handleSetDragStart(e: React.DragEvent, setId: string) {
    setSetDragId(setId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", setId);
  }
  function handleSetDragEnd() {
    setSetDragId(null);
    setSetDropTargetId(null);
  }
  function handleSetDragOver(e: React.DragEvent, setId: string) {
    e.preventDefault();
    if (setDragId && setDragId !== setId) setSetDropTargetId(setId);
  }
  async function handleSetDrop(e: React.DragEvent, targetSetId: string, exerciseId: string, orderedSetIds: string[]) {
    e.preventDefault();
    setSetDropTargetId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetSetId) {
      setSetDragId(null);
      return;
    }
    const srcIdx = orderedSetIds.indexOf(sourceId);
    const tgtIdx = orderedSetIds.indexOf(targetSetId);
    if (srcIdx === -1 || tgtIdx === -1) {
      setSetDragId(null);
      return;
    }
    const newOrder = [...orderedSetIds];
    const [removed] = newOrder.splice(srcIdx, 1);
    newOrder.splice(tgtIdx, 0, removed);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/sets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedSetIds: newOrder }),
      });
      if (!res.ok) throw new Error("Reorder failed");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
    setSetDragId(null);
  }

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddExercise = async () => {
    const name = addExerciseName.trim();
    if (!name || addExerciseLoading) return;
    setAddExerciseLoading(true);
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to add exercise");
      setAddExerciseName("");
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setAddExerciseLoading(false);
    }
  };

  const handleExDragStart = (e: React.DragEvent, exerciseId: string) => {
    setExDragId(exerciseId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", exerciseId);
  };
  const handleExDragOver = (e: React.DragEvent, exerciseId: string) => {
    e.preventDefault();
    if (exDragId && exDragId !== exerciseId) setExDropTargetId(exerciseId);
  };
  const handleExDragLeave = () => setExDropTargetId(null);
  const handleExDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setExDropTargetId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setExDragId(null);
      return;
    }
    const srcIdx = exercises.findIndex((ex) => ex.id === sourceId);
    const tgtIdx = exercises.findIndex((ex) => ex.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) {
      setExDragId(null);
      return;
    }
    const newOrder = [...exercises];
    const [removed] = newOrder.splice(srcIdx, 1);
    newOrder.splice(tgtIdx, 0, removed);
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}/exercises`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedExerciseIds: newOrder.map((ex) => ex.id) }),
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error(err);
    }
    setExDragId(null);
  };
  const handleExDragEnd = () => {
    setExDragId(null);
    setExDropTargetId(null);
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm("Remove this exercise from the workout? Its sets and logs for this day will be removed.")) return;
    setDeletingExId(exerciseId);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingExId(null);
    }
  };

  const handleMoveExercise = async (exerciseId: string, targetDayId: string) => {
    if (targetDayId === workoutDayId) return;
    setMovingExId(exerciseId);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutDayId: targetDayId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setMovingExId(null);
    }
  };

  if (exercises.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground mb-4">No exercises yet. Add one to start logging.</p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <Input
              placeholder="Exercise name (e.g. Bench Press)"
              value={addExerciseName}
              onChange={(e) => setAddExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddExercise()}
              className="flex-1"
            />
            <Button onClick={() => void handleAddExercise()} disabled={!addExerciseName.trim() || addExerciseLoading}>
              {addExerciseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addExerciseLoading ? "Adding…" : "Add exercise"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getReplaceSelectValue = (ex: Exercise) => {
    const override = overridesByExercise[ex.id];
    if (override === undefined || override === ex.name) return "";
    if (override === ex.substitution1) return "sub1";
    if (override === ex.substitution2) return "sub2";
    return "custom";
  };

  const canReorderExercises = exercises.length >= 2;

  return (
    <div className="space-y-4">
      {exercises.map((ex) => {
        const logged = loggedByExercise[ex.id] ?? [];
        const previous = previousByExercise[ex.id] ?? [];
        const isExpanded = expandedExercise === ex.id;
        const displayName = overridesByExercise[ex.id] ?? ex.name;
        const showCustomInput = customReplaceExId === ex.id;
        return (
          <div
            key={ex.id}
            onDragOver={canReorderExercises ? (e) => handleExDragOver(e, ex.id) : undefined}
            onDragLeave={handleExDragLeave}
            onDrop={canReorderExercises ? (e) => handleExDrop(e, ex.id) : undefined}
            className={canReorderExercises && exDropTargetId === ex.id ? "ring-2 ring-primary rounded-lg" : ""}
          >
            <Card className={exDragId === ex.id ? "opacity-60" : ""}>
              <CardHeader
                className="cursor-pointer py-4"
                onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1 min-w-0 flex-1">
                    {canReorderExercises && (
                      <div
                        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground touch-none mt-0.5"
                        draggable
                        onDragStart={(e) => handleExDragStart(e, ex.id)}
                        onDragEnd={handleExDragEnd}
                        onClick={(e) => e.stopPropagation()}
                        aria-hidden
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{displayName}</CardTitle>
                  {(() => {
                    const repRange = repRangeLabel(ex.templateSets?.[0]?.targetReps ?? null);
                    return repRange ? (
                      <p className="text-xs text-muted-foreground mt-0.5">Rep range: {repRange}</p>
                    ) : null;
                  })()}
                  {isExpanded && recommendationByEx[ex.id] && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      {recommendationByEx[ex.id]}
                    </p>
                  )}
                  {previous.length > 0 && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last: {previous.slice(0, 3).map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}${s.rir != null ? ` RIR${s.rir}` : ""}`).join(", ")}
                    </p>
                  )}
                  {isExpanded && (
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Replace className="h-3 w-3" />
                        Replace with
                      </span>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={getReplaceSelectValue(ex)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") setExerciseDisplay(ex.id, null);
                          else if (v === "sub1" && ex.substitution1) setExerciseDisplay(ex.id, ex.substitution1);
                          else if (v === "sub2" && ex.substitution2) setExerciseDisplay(ex.id, ex.substitution2);
                          else if (v === "custom") {
                            setCustomReplaceExId(ex.id);
                            setCustomReplaceValue(overridesByExercise[ex.id] ?? "");
                          }
                        }}
                      >
                        <option value="">Original: {ex.name}</option>
                        {ex.substitution1 && (
                          <option value="sub1">{ex.substitution1}</option>
                        )}
                        {ex.substitution2 && (
                          <option value="sub2">{ex.substitution2}</option>
                        )}
                        <option value="custom">Type custom...</option>
                      </select>
                      {showCustomInput && (
                        <>
                          <Input
                            className="h-8 w-40 text-sm"
                            placeholder="Exercise name"
                            value={customReplaceValue}
                            onChange={(e) => setCustomReplaceValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setExerciseDisplay(ex.id, customReplaceValue);
                            }}
                            onBlur={() => {
                              if (customReplaceValue.trim()) setExerciseDisplay(ex.id, customReplaceValue);
                              else setCustomReplaceExId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => setExerciseDisplay(ex.id, customReplaceValue)}
                          >
                            Save
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`View history for ${displayName}`}
                    asChild
                  >
                    <Link
                      href={`/history/name/${encodeURIComponent(ex.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center"
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Link>
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {previous.length > 0 && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-muted-foreground mb-1">Previous (by week)</p>
                    <div className="flex flex-col gap-1.5">
                      {previous.slice(0, 8).map((s, i) => {
                        const est1RM = epley1RM(s.weight, s.reps);
                        return (
                          <span key={i} className="text-muted-foreground text-xs">
                            Set {s.setNumber}: {s.reps ?? "—"}×{s.weight ?? "—"} lb{s.rir != null ? ` RIR${s.rir}` : ""}
                            {est1RM != null && <span className="ml-1">· est. 1RM: {est1RM} lb</span>}
                            {s.completedAt && (
                              <span className="ml-1 opacity-80">
                                · {new Date(s.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {((Array.isArray(ex.templateSets) && ex.templateSets.length > 0) ? ex.templateSets : [{ id: "", setNumber: 1, targetReps: null, targetWeight: null, targetRir: null }]).map((tmpl) => {
                    const existing = logged.find((l) => l.setNumber === tmpl.setNumber);
                    const lastWeight = previous[0]?.weight;
                    const setId = tmpl && typeof tmpl === "object" && "id" in tmpl && tmpl.id ? String(tmpl.id) : "";
                    const templateSetsList = Array.isArray(ex.templateSets) ? ex.templateSets : [];
                    const orderedSetIds = templateSetsList.map((s) => s && (s as { id?: string }).id).filter(Boolean) as string[];
                    const canReorder = orderedSetIds.length >= 2 && setId;
                    const wrapper = (
                      <div
                        key={setId || `set-${tmpl.setNumber}`}
                        onDragOver={canReorder ? (e) => handleSetDragOver(e, setId) : undefined}
                        onDragLeave={() => setSetDropTargetId(null)}
                        onDrop={canReorder ? (e) => handleSetDrop(e, setId, ex.id, orderedSetIds) : undefined}
                        className={`flex items-center gap-1 ${canReorder ? (setDropTargetId === setId ? "ring-2 ring-primary rounded-lg" : "") : ""}`}
                      >
                        {canReorder ? (
                          <div
                            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
                            draggable
                            onDragStart={(e) => handleSetDragStart(e, setId)}
                            onDragEnd={handleSetDragEnd}
                            aria-hidden
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                        ) : null}
                        <div className={`flex-1 min-w-0 ${setDragId === setId ? "opacity-50" : ""}`}>
                          <SetRow
                            setNumber={tmpl.setNumber}
                            targetReps={tmpl.targetReps}
                            targetWeight={tmpl.targetWeight}
                            targetRir={tmpl.targetRir ?? null}
                            initialReps={existing?.reps ?? tmpl.targetReps ?? undefined}
                            initialWeight={existing?.weight ?? tmpl.targetWeight ?? (lastWeight != null ? lastWeight : undefined)}
                            initialRir={existing?.rir ?? tmpl.targetRir ?? undefined}
                            onLog={(reps, weight, rir, isWarmup) => logSet(ex.id, tmpl.setNumber, { reps, weight, rir, isWarmup })}
                          />
                        </div>
                      </div>
                    );
                    return wrapper;
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleAddSet(ex.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add set
                </Button>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteExercise(ex.id)}
                    disabled={deletingExId === ex.id}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete exercise
                  </Button>
                  {programId && programDays && programDays.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Move to:</span>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[140px]"
                        value=""
                        onChange={(e) => {
                          const dayId = e.target.value;
                          if (dayId) handleMoveExercise(ex.id, dayId);
                          e.target.value = "";
                        }}
                        disabled={movingExId === ex.id}
                      >
                        <option value="">Select day…</option>
                        {programDays
                          .filter((d) => d.id !== workoutDayId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              Week {d.weekNumber}, Day {d.dayNumber}
                              {d.name ? ` — ${d.name}` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
            </Card>
          </div>
        );
      })}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Add another exercise"
              value={addExerciseName}
              onChange={(e) => setAddExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddExercise()}
              className="flex-1"
            />
            <Button variant="outline" onClick={() => void handleAddExercise()} disabled={!addExerciseName.trim() || addExerciseLoading}>
              {addExerciseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addExerciseLoading ? "Adding…" : "Add exercise"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border py-3 px-4 mt-6 rounded-t-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {lastSavedAt ? (
            <>
              <Check className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
              <span>Changes saved — your logs are stored when you tap Log on each set.</span>
            </>
          ) : (
            <span>Tap &quot;Log&quot; on each set to save reps, weight, and RIR. Changes save immediately.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SetRow({
  setNumber,
  targetReps,
  targetWeight,
  targetRir,
  initialReps,
  initialWeight,
  initialRir,
  onLog,
}: {
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  targetRir: number | null;
  initialReps: number | null | undefined;
  initialWeight: number | null | undefined;
  initialRir: number | null | undefined;
  onLog: (reps?: number, weight?: number, rir?: number, isWarmup?: boolean) => void | Promise<void>;
}) {
  const [reps, setReps] = useState(initialReps ?? undefined);
  const [weight, setWeight] = useState(initialWeight ?? undefined);
  const [rir, setRir] = useState(initialRir ?? undefined);
  const [isWarmup, setIsWarmup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  useEffect(() => {
    setReps(initialReps ?? undefined);
    setWeight(initialWeight ?? undefined);
    setRir(initialRir ?? undefined);
  }, [initialReps, initialWeight, initialRir]);

  const handleSave = async () => {
    setSaving(true);
    setSavedJustNow(false);
    try {
      await Promise.resolve(onLog(reps, weight, rir, isWarmup));
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const inc = (v: number | undefined, step: number, min = 0) =>
    v != null ? Math.max(min, v + step) : (min + step);
  const dec = (v: number | undefined, step: number, min = 0) =>
    v != null ? Math.max(min, v - step) : min;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
      <span className="w-8 shrink-0 text-sm font-medium text-muted-foreground">
        {setNumber}
      </span>
      <div className="flex-1 min-w-[80px]">
        <Label className="text-xs">Reps</Label>
        <div className="flex items-center gap-0.5 mt-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setReps((r) => dec(r, 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={0}
            placeholder={targetReps != null ? String(targetReps) : "—"}
            value={reps ?? ""}
            onChange={(e) => setReps(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="h-9 flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setReps((r) => inc(r, 1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-w-[80px]">
        <Label className="text-xs">Weight (lb)</Label>
        <div className="flex items-center gap-0.5 mt-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setWeight((w) => dec(w ?? 0, 2.5, 0))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={0}
            step={0.5}
            placeholder={targetWeight != null ? String(targetWeight) : "—"}
            value={weight ?? ""}
            onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
            className="h-9 flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setWeight((w) => inc(w ?? 0, 2.5))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="w-16">
        <Label className="text-xs">RIR</Label>
        <Input
          type="number"
          min={0}
          max={10}
          placeholder={targetRir != null ? String(targetRir) : "—"}
          value={rir ?? ""}
          onChange={(e) => setRir(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          className="h-9 mt-0.5"
        />
      </div>
      {epley1RM(weight, reps) != null && (
        <div className="shrink-0 self-end pb-2">
          <span className="text-xs text-muted-foreground">est. 1RM: {epley1RM(weight, reps)} lb</span>
        </div>
      )}
      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={isWarmup}
          onChange={(e) => setIsWarmup(e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-xs text-muted-foreground">Warm-up</span>
      </label>
      <Button
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving}
        variant={savedJustNow ? "secondary" : "default"}
        className={savedJustNow ? "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : ""}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : savedJustNow ? (
          <>
            <Check className="h-4 w-4 mr-1 shrink-0" />
            Saved
          </>
        ) : (
          "Log"
        )}
      </Button>
    </div>
  );
}
