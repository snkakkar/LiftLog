"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Replace,
  Minus,
  Plus,
  GripVertical,
  Check,
  Trash2,
  ArrowRightCircle,
  History,
  Link2,
} from "lucide-react";
import { SwipeToDeleteRow } from "@/components/swipe-to-delete";

type TemplateSet = {
  id: string;
  setNumber: number;
  targetReps: number | null;
  targetRepsMin: number | null;
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
  supersetGroupId?: string | null;
};

type ExerciseBlock =
  | { type: "single"; exercise: Exercise }
  | { type: "superset"; first: Exercise; second: Exercise; groupId: string };

function buildExerciseBlocks(exercises: Exercise[]): ExerciseBlock[] {
  const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  const used = new Set<string>();
  const blocks: ExerciseBlock[] = [];
  for (const ex of sorted) {
    if (used.has(ex.id)) continue;
    const gid = ex.supersetGroupId?.trim();
    if (gid) {
      const partner = sorted.find((p) => p.id !== ex.id && p.supersetGroupId === gid);
      if (partner) {
        used.add(ex.id);
        used.add(partner.id);
        const [first, second] =
          ex.orderIndex <= partner.orderIndex ? [ex, partner] : [partner, ex];
        blocks.push({ type: "superset", first, second, groupId: gid });
        continue;
      }
    }
    blocks.push({ type: "single", exercise: ex });
  }
  return blocks;
}

function getExerciseBlockKey(block: ExerciseBlock): string {
  return block.type === "single" ? block.exercise.id : `superset:${block.groupId}`;
}

function maxDisplayedSetCount(
  a: Exercise,
  b: Exercise,
  loggedA: LoggedSet[],
  loggedB: LoggedSet[]
): number {
  const tmplMax = Math.max(
    Array.isArray(a.templateSets) ? a.templateSets.length : 0,
    Array.isArray(b.templateSets) ? b.templateSets.length : 0,
    1
  );
  const logA = loggedA.length ? Math.max(...loggedA.map((s) => s.setNumber)) : 0;
  const logB = loggedB.length ? Math.max(...loggedB.map((s) => s.setNumber)) : 0;
  return Math.max(tmplMax, logA, logB, 1);
}

function templateForSetNumber(ex: Exercise, setNumber: number): TemplateSet {
  const list = Array.isArray(ex.templateSets) ? ex.templateSets : [];
  const found = list.find((s) => s.setNumber === setNumber);
  if (found) return found;
  return {
    id: "",
    setNumber,
    targetReps: null,
    targetRepsMin: null,
    targetWeight: null,
    targetRir: null,
  };
}

/** Used to switch superset set layout: labeled stacks on small screens vs side‑by‑side with set numbers on lg+. */
function useMinWidthLg() {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setMatch(mq.matches);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return match;
}
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

function safeExerciseName(name: unknown): string {
  if (typeof name === "string") return name;
  const s = String(name ?? "");
  return s.replace(/^\[object \w+\]$/, "") || "Exercise";
}

function repRangeLabel(targetReps: number | null, targetRepsMin?: number | null): string {
  if (targetReps == null || targetReps < 1) return "";
  if (targetRepsMin != null && targetRepsMin >= 1 && targetRepsMin < targetReps) {
    return `${targetRepsMin}–${targetReps} reps`;
  }
  return `${targetReps} reps`;
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
  const [expandedKey, setExpandedKey] = useState<string | null>(() => {
    const blocks = buildExerciseBlocks(Array.isArray(exercisesProp) ? exercisesProp : []);
    const b0 = blocks[0];
    return b0 ? getExerciseBlockKey(b0) : null;
  });
  const [customReplaceExId, setCustomReplaceExId] = useState<string | null>(null);
  const [customReplaceValue, setCustomReplaceValue] = useState("");
  const [recommendationByEx, setRecommendationByEx] = useState<Record<string, string | null>>({});
  const [addExerciseName, setAddExerciseName] = useState("");
  const [addExerciseLoading, setAddExerciseLoading] = useState(false);
  const [programDays, setProgramDays] = useState<{ id: string; weekNumber: number; dayNumber: number; name: string | null }[] | null>(null);
  const [deletingExId, setDeletingExId] = useState<string | null>(null);
  const [movingExId, setMovingExId] = useState<string | null>(null);
  const [propagatePending, setPropagatePending] = useState<{ exerciseId: string; label: string } | null>(null);
  const [propagating, setPropagating] = useState(false);
  const [editingRepRangeExId, setEditingRepRangeExId] = useState<string | null>(null);
  const [editingRepRangeMin, setEditingRepRangeMin] = useState("");
  const [editingRepRangeMax, setEditingRepRangeMax] = useState("");
  const [isDeload, setIsDeload] = useState(false);
  const isLgScreen = useMinWidthLg();

  const ensureSession = useCallback(async () => {
    const existingRes = await fetch(
      `/api/sessions/by-day?workoutDayId=${encodeURIComponent(workoutDayId)}`
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      if (existing?.id) {
        setSessionId(existing.id);
        if (existing.isDeload) setIsDeload(true);
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
      const n = safeExerciseName(ex.name);
      if (n.trim()) params.set("exerciseName", n.trim());
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
    if (!expandedKey) return;
    const fetchRec = (ex: Exercise) => {
      if (recommendationByEx[ex.id] !== undefined) return;
      const recParams = new URLSearchParams();
      if (programId) recParams.set("programId", programId);
      if (currentWeekNumber != null) recParams.set("currentWeekNumber", String(currentWeekNumber));
      fetch(`/api/exercises/${ex.id}/recommendation?${recParams}`)
        .then((r) => r.json())
        .then((data: { suggestion?: string | null }) =>
          setRecommendationByEx((prev) => ({ ...prev, [ex.id]: data.suggestion ?? null }))
        )
        .catch(() => setRecommendationByEx((prev) => ({ ...prev, [ex.id]: null })));
    };
    if (expandedKey.startsWith("superset:")) {
      const gid = expandedKey.slice("superset:".length);
      exercises.filter((e) => e.supersetGroupId === gid).forEach(fetchRec);
      return;
    }
    const ex = exercises.find((e) => e.id === expandedKey);
    if (ex) fetchRec(ex);
  }, [expandedKey, exercises, recommendationByEx, programId, currentWeekNumber]);

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

  async function handleAddSet(exerciseId: string, exerciseName: string) {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Add set failed");
      router.refresh();
      if (currentWeekNumber != null) {
        setPropagatePending({ exerciseId, label: exerciseName });
      }
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

  const handleExDragStart = (e: React.DragEvent, blockKey: string) => {
    setExDragId(blockKey);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", blockKey);
  };
  const handleExDragOver = (e: React.DragEvent, blockKey: string) => {
    e.preventDefault();
    if (exDragId && exDragId !== blockKey) setExDropTargetId(blockKey);
  };
  const handleExDragLeave = () => setExDropTargetId(null);
  const handleExDrop = async (e: React.DragEvent, targetBlockKey: string) => {
    e.preventDefault();
    setExDropTargetId(null);
    const sourceKey = e.dataTransfer.getData("text/plain");
    if (!sourceKey || sourceKey === targetBlockKey) {
      setExDragId(null);
      return;
    }
    const blocks = buildExerciseBlocks(exercises);
    const srcIdx = blocks.findIndex((b) => getExerciseBlockKey(b) === sourceKey);
    const tgtIdx = blocks.findIndex((b) => getExerciseBlockKey(b) === targetBlockKey);
    if (srcIdx === -1 || tgtIdx === -1) {
      setExDragId(null);
      return;
    }
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(srcIdx, 1);
    newBlocks.splice(tgtIdx, 0, removed);
    const orderedIds = newBlocks.flatMap((b) =>
      b.type === "single" ? [b.exercise.id] : [b.first.id, b.second.id]
    );
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}/exercises`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedExerciseIds: orderedIds }),
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

  async function handleDeleteLoggedSet(setId: string, exerciseId: string, setNumber: number) {
    try {
      const res = await fetch(`/api/logged-sets/${setId}`, { method: "DELETE" });
      if (!res.ok) return;
      setLoggedByExercise((prev) => {
        const list = prev[exerciseId] ?? [];
        return {
          ...prev,
          [exerciseId]: list.filter((s) => s.setNumber !== setNumber),
        };
      });
      setLastSavedAt(new Date());
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteTemplateSet(setId: string, exerciseId: string, exerciseName?: string) {
    if (!setId) return;
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/sets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId }),
      });
      if (res.ok) {
        router.refresh();
        if (currentWeekNumber != null && exerciseName) {
          setPropagatePending({ exerciseId, label: exerciseName });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  const handleSaveRepRange = async (exerciseId: string, min: string, max: string) => {
    const parsedMax = parseInt(max.trim(), 10);
    const parsedMin = parseInt(min.trim(), 10);
    const targetReps = isNaN(parsedMax) || parsedMax < 1 ? null : parsedMax;
    const targetRepsMin = !isNaN(parsedMin) && parsedMin >= 1 && targetReps != null && parsedMin < targetReps ? parsedMin : null;
    setEditingRepRangeExId(null);
    setEditingRepRangeMin("");
    setEditingRepRangeMax("");
    await fetch(`/api/exercises/${exerciseId}/sets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetReps, targetRepsMin }),
    });
    router.refresh();
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

  const handlePropagate = async (exerciseId: string) => {
    setPropagating(true);
    try {
      await fetch(`/api/workout-day/${workoutDayId}/propagate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
    } finally {
      setPropagating(false);
      setPropagatePending(null);
    }
  };

  const handleToggleDeload = async (value: boolean) => {
    setIsDeload(value);
    const sid = sessionId ?? (await ensureSession());
    if (!sid) return;
    await fetch(`/api/sessions/${sid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeload: value }),
    });
  };

  const handleCreateSuperset = async (exerciseId: string, partnerId: string) => {
    if (!partnerId || exerciseId === partnerId) return;
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}/superset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseIdA: exerciseId, exerciseIdB: partnerId }),
      });
      if (res.ok) router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveSuperset = async (exerciseId: string) => {
    try {
      const res = await fetch(`/api/workout-day/${workoutDayId}/superset`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      if (res.ok) {
        setExpandedKey(null);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSupersetSets = async (idA: string, idB: string) => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/exercises/${idA}/sets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        fetch(`/api/exercises/${idB}/sets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      ]);
      if (r1.ok && r2.ok) router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  async function handleSupersetRowDelete(
    setNumber: number,
    exA: Exercise,
    exB: Exercise,
    loggedA: LoggedSet | undefined,
    loggedB: LoggedSet | undefined
  ) {
    const tmplA = templateForSetNumber(exA, setNumber);
    const tmplB = templateForSetNumber(exB, setNumber);
    const countA = Array.isArray(exA.templateSets) ? exA.templateSets.length : 0;
    const countB = Array.isArray(exB.templateSets) ? exB.templateSets.length : 0;
    const setIdA = tmplA.id ? String(tmplA.id) : "";
    const setIdB = tmplB.id ? String(tmplB.id) : "";
    if (loggedA) await handleDeleteLoggedSet(loggedA.id, exA.id, setNumber);
    else if (setIdA && countA > 1) await handleDeleteTemplateSet(setIdA, exA.id, safeExerciseName(exA.name));
    if (loggedB) await handleDeleteLoggedSet(loggedB.id, exB.id, setNumber);
    else if (setIdB && countB > 1) await handleDeleteTemplateSet(setIdB, exB.id, safeExerciseName(exB.name));
    router.refresh();
  }

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
    if (override === undefined || override === safeExerciseName(ex.name)) return "";
    if (override === ex.substitution1) return "sub1";
    if (override === ex.substitution2) return "sub2";
    return "custom";
  };

  const exerciseBlocks = buildExerciseBlocks(exercises);
  const canReorderExercises = exerciseBlocks.length >= 2;

  return (
    <div className="space-y-4">
      {propagatePending && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm flex-1">
            Apply this change to <span className="font-medium break-words">{propagatePending.label}</span> in all subsequent weeks too?
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="h-8"
              disabled={propagating}
              onClick={() => void handlePropagate(propagatePending.exerciseId)}
            >
              {propagating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, apply to all"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              disabled={propagating}
              onClick={() => setPropagatePending(null)}
            >
              No, just this week
            </Button>
          </div>
        </div>
      )}
      {exerciseBlocks.map((block) => {
        const bKey = getExerciseBlockKey(block);
        if (block.type === "superset") {
          const { first: exA, second: exB } = block;
          const loggedA = loggedByExercise[exA.id] ?? [];
          const loggedB = loggedByExercise[exB.id] ?? [];
          const prevA = previousByExercise[exA.id] ?? [];
          const prevB = previousByExercise[exB.id] ?? [];
          const dispA = overridesByExercise[exA.id] ?? safeExerciseName(exA.name);
          const dispB = overridesByExercise[exB.id] ?? safeExerciseName(exB.name);
          const isEx = expandedKey === bKey;
          const setCount = maxDisplayedSetCount(exA, exB, loggedA, loggedB);
          return (
            <div
              key={bKey}
              onDragOver={canReorderExercises ? (e) => handleExDragOver(e, bKey) : undefined}
              onDragLeave={handleExDragLeave}
              onDrop={canReorderExercises ? (e) => handleExDrop(e, bKey) : undefined}
              className={canReorderExercises && exDropTargetId === bKey ? "ring-2 ring-primary rounded-lg" : ""}
            >
              <Card className={exDragId === bKey ? "opacity-60" : ""}>
                <CardHeader className="cursor-pointer py-4" onClick={() => setExpandedKey(isEx ? null : bKey)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1 min-w-0 flex-1">
                      {canReorderExercises && (
                        <div
                          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground touch-none mt-0.5"
                          draggable
                          onDragStart={(e) => handleExDragStart(e, bKey)}
                          onDragEnd={handleExDragEnd}
                          onClick={(e) => e.stopPropagation()}
                          aria-hidden
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          Superset
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <CardTitle className="text-base">{dispA}</CardTitle>
                            <RepRangeDisplay
                              exerciseId={exA.id}
                              targetReps={exA.templateSets?.[0]?.targetReps ?? null}
                              targetRepsMin={exA.templateSets?.[0]?.targetRepsMin ?? null}
                              editingExId={editingRepRangeExId}
                              editingMin={editingRepRangeMin}
                              editingMax={editingRepRangeMax}
                              onStartEdit={(id, min, max) => { setEditingRepRangeExId(id); setEditingRepRangeMin(min); setEditingRepRangeMax(max); }}
                              onSave={handleSaveRepRange}
                              onCancel={() => setEditingRepRangeExId(null)}
                              onChangeMin={setEditingRepRangeMin}
                              onChangeMax={setEditingRepRangeMax}
                            />
                          </div>
                          <div>
                            <CardTitle className="text-base">{dispB}</CardTitle>
                            <RepRangeDisplay
                              exerciseId={exB.id}
                              targetReps={exB.templateSets?.[0]?.targetReps ?? null}
                              targetRepsMin={exB.templateSets?.[0]?.targetRepsMin ?? null}
                              editingExId={editingRepRangeExId}
                              editingMin={editingRepRangeMin}
                              editingMax={editingRepRangeMax}
                              onStartEdit={(id, min, max) => { setEditingRepRangeExId(id); setEditingRepRangeMin(min); setEditingRepRangeMax(max); }}
                              onSave={handleSaveRepRange}
                              onCancel={() => setEditingRepRangeExId(null)}
                              onChangeMin={setEditingRepRangeMin}
                              onChangeMax={setEditingRepRangeMax}
                            />
                          </div>
                        </div>
                        {isEx && recommendationByEx[exA.id] && (
                          <p className="text-xs text-primary font-medium">{recommendationByEx[exA.id]}</p>
                        )}
                        {isEx && recommendationByEx[exB.id] && (
                          <p className="text-xs text-primary font-medium">{recommendationByEx[exB.id]}</p>
                        )}
                        {!isEx && (prevA.length > 0 || prevB.length > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {prevA.length > 0 && (
                              <span>
                                {dispA}: {prevA.slice(0, 2).map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}`).join(", ")}
                              </span>
                            )}
                            {prevA.length > 0 && prevB.length > 0 && " · "}
                            {prevB.length > 0 && (
                              <span>
                                {dispB}: {prevB.slice(0, 2).map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}`).join(", ")}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" asChild>
                          <Link
                            href={`/history/name/${encodeURIComponent(safeExerciseName(exA.name))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center"
                          >
                            <History className="h-4 w-4 mr-1" />
                            A
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" asChild>
                          <Link
                            href={`/history/name/${encodeURIComponent(safeExerciseName(exB.name))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center"
                          >
                            <History className="h-4 w-4 mr-1" />
                            B
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); void handleRemoveSuperset(exA.id); }}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Split
                        </Button>
                      </div>
                      {isEx ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isEx && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {[exA, exB].map((exItem) => {
                        const prev = exItem.id === exA.id ? prevA : prevB;
                        return (
                          <div key={exItem.id}>
                            {prev.length > 0 && (
                              <div className="rounded-md bg-muted/50 p-3 text-sm mb-2">
                                <p className="font-medium text-muted-foreground mb-1">
                                  {overridesByExercise[exItem.id] ?? safeExerciseName(exItem.name)} — Previous
                                </p>
                                <div className="flex flex-col gap-1.5">
                                  {prev.slice(0, 6).map((s, i) => (
                                    <span key={i} className="text-muted-foreground text-xs">
                                      Set {s.setNumber}: {s.reps ?? "—"}×{s.weight ?? "—"} lb
                                      {s.rir != null ? ` RIR${s.rir}` : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Replace className="h-3 w-3" />
                                Replace
                              </span>
                              <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                value={getReplaceSelectValue(exItem)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "") setExerciseDisplay(exItem.id, null);
                                  else if (v === "sub1" && exItem.substitution1)
                                    setExerciseDisplay(exItem.id, exItem.substitution1);
                                  else if (v === "sub2" && exItem.substitution2)
                                    setExerciseDisplay(exItem.id, exItem.substitution2);
                                  else if (v === "custom") {
                                    setCustomReplaceExId(exItem.id);
                                    setCustomReplaceValue(overridesByExercise[exItem.id] ?? "");
                                  }
                                }}
                              >
                                <option value="">Original: {safeExerciseName(exItem.name)}</option>
                                {exItem.substitution1 && <option value="sub1">{exItem.substitution1}</option>}
                                {exItem.substitution2 && <option value="sub2">{exItem.substitution2}</option>}
                                <option value="custom">Type custom...</option>
                              </select>
                              {customReplaceExId === exItem.id && (
                                <>
                                  <Input
                                    className="h-8 w-full sm:w-40 text-sm"
                                    placeholder="Exercise name"
                                    value={customReplaceValue}
                                    onChange={(e) => setCustomReplaceValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void setExerciseDisplay(exItem.id, customReplaceValue);
                                    }}
                                    onBlur={(e) => {
                                      if (!e.relatedTarget) setCustomReplaceExId(null);
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8"
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={() => void setExerciseDisplay(exItem.id, customReplaceValue)}
                                  >
                                    Save
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-3">
                      <div className="hidden lg:grid lg:grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-0 px-0.5 mb-1">
                        <div className="text-sm font-semibold leading-tight truncate pb-2 border-b border-border">
                          {dispA}
                        </div>
                        <div className="text-sm font-semibold leading-tight truncate pb-2 border-b border-border">
                          {dispB}
                        </div>
                        <div className="w-8 pb-2 border-b border-border shrink-0" aria-hidden />
                      </div>
                      {Array.from({ length: setCount }, (_, i) => i + 1).map((sn) => {
                        const tmplA = templateForSetNumber(exA, sn);
                        const tmplB = templateForSetNumber(exB, sn);
                        const existingA = loggedA.find((l) => l.setNumber === sn);
                        const existingB = loggedB.find((l) => l.setNumber === sn);
                        const setIdA = tmplA.id ? String(tmplA.id) : "";
                        const setIdB = tmplB.id ? String(tmplB.id) : "";
                        const countTA = Array.isArray(exA.templateSets) ? exA.templateSets.length : 0;
                        const countTB = Array.isArray(exB.templateSets) ? exB.templateSets.length : 0;
                        const canRowDel =
                          !!existingA || !!existingB || (setIdA && countTA > 1) || (setIdB && countTB > 1);
                        const onRowDel = () => void handleSupersetRowDelete(sn, exA, exB, existingA, existingB);
                        const hideSetNum = !isLgScreen;
                        const rowInner = (
                          <div
                            className={
                              isLgScreen
                                ? "flex flex-row gap-2 items-stretch"
                                : "flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm"
                            }
                          >
                            {!isLgScreen && (
                              <div className="bg-muted/80 px-3 py-2 text-center border-b border-border">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Set {sn}
                                </span>
                              </div>
                            )}
                            <div
                              className={
                                isLgScreen
                                  ? "flex min-w-0 flex-1 flex-row gap-2 items-stretch"
                                  : "flex flex-col gap-3 p-3"
                              }
                            >
                              <div className="flex-1 min-w-0 space-y-1.5">
                                {!isLgScreen && (
                                  <p className="text-sm font-semibold text-foreground truncate border-l-2 border-primary pl-2">
                                    {dispA}
                                  </p>
                                )}
                                <div
                                  className={
                                    isLgScreen ? "" : "rounded-lg border border-primary/25 bg-primary/5 p-1"
                                  }
                                >
                                  <SetRow
                                    setNumber={sn}
                                    hideSetNumber={hideSetNum}
                                    targetReps={tmplA.targetReps}
                                    targetWeight={tmplA.targetWeight}
                                    targetRir={tmplA.targetRir ?? null}
                                    initialReps={existingA?.reps ?? tmplA.targetReps ?? undefined}
                                    initialWeight={
                                      existingA?.weight ??
                                      tmplA.targetWeight ??
                                      (prevA[0]?.weight != null ? prevA[0]?.weight : undefined)
                                    }
                                    initialRir={existingA?.rir ?? tmplA.targetRir ?? undefined}
                                    onLog={(reps, weight, rir, isWarmup) =>
                                      logSet(exA.id, sn, { reps, weight, rir, isWarmup })
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                {!isLgScreen && (
                                  <p className="text-sm font-semibold text-foreground truncate border-l-2 border-secondary pl-2">
                                    {dispB}
                                  </p>
                                )}
                                <div
                                  className={
                                    isLgScreen ? "" : "rounded-lg border border-secondary/40 bg-secondary/15 p-1"
                                  }
                                >
                                  <SetRow
                                    setNumber={sn}
                                    hideSetNumber={hideSetNum}
                                    targetReps={tmplB.targetReps}
                                    targetWeight={tmplB.targetWeight}
                                    targetRir={tmplB.targetRir ?? null}
                                    initialReps={existingB?.reps ?? tmplB.targetReps ?? undefined}
                                    initialWeight={
                                      existingB?.weight ??
                                      tmplB.targetWeight ??
                                      (prevB[0]?.weight != null ? prevB[0]?.weight : undefined)
                                    }
                                    initialRir={existingB?.rir ?? tmplB.targetRir ?? undefined}
                                    onLog={(reps, weight, rir, isWarmup) =>
                                      logSet(exB.id, sn, { reps, weight, rir, isWarmup })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            {canRowDel && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`h-8 shrink-0 text-muted-foreground hover:text-destructive ${isLgScreen ? "self-center" : "self-end mr-3 mb-2"}`}
                                onClick={onRowDel}
                                aria-label="Delete superset row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                        return canRowDel ? (
                          <SwipeToDeleteRow key={`ss-${sn}`} onDelete={onRowDel} className="rounded-lg">
                            {rowInner}
                          </SwipeToDeleteRow>
                        ) : (
                          <div key={`ss-${sn}`}>{rowInner}</div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => void handleAddSupersetSets(exA.id, exB.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add set (both)
                    </Button>
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => void handleRemoveSuperset(exA.id)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Split superset
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteExercise(exA.id)}
                        disabled={deletingExId === exA.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete {dispA}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteExercise(exB.id)}
                        disabled={deletingExId === exB.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete {dispB}
                      </Button>
                      {programId && programDays && programDays.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Move A:</span>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[120px]"
                            value=""
                            onChange={(e) => {
                              const dayId = e.target.value;
                              if (dayId) void handleMoveExercise(exA.id, dayId);
                              e.target.value = "";
                            }}
                            disabled={movingExId === exA.id}
                          >
                            <option value="">Select day…</option>
                            {programDays
                              .filter((d) => d.id !== workoutDayId)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  W{d.weekNumber} D{d.dayNumber}
                                  {d.name ? ` — ${d.name}` : ""}
                                </option>
                              ))}
                          </select>
                          <span className="text-xs text-muted-foreground">B:</span>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[120px]"
                            value=""
                            onChange={(e) => {
                              const dayId = e.target.value;
                              if (dayId) void handleMoveExercise(exB.id, dayId);
                              e.target.value = "";
                            }}
                            disabled={movingExId === exB.id}
                          >
                            <option value="">Select day…</option>
                            {programDays
                              .filter((d) => d.id !== workoutDayId)
                              .map((d) => (
                                <option key={`b-${d.id}`} value={d.id}>
                                  W{d.weekNumber} D{d.dayNumber}
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
        }
        const ex = block.exercise;
        const logged = loggedByExercise[ex.id] ?? [];
        const previous = previousByExercise[ex.id] ?? [];
        const isExpanded = expandedKey === bKey;
        const displayName = overridesByExercise[ex.id] ?? safeExerciseName(ex.name);
        const showCustomInput = customReplaceExId === ex.id;
        return (
          <div
            key={bKey}
            onDragOver={canReorderExercises ? (e) => handleExDragOver(e, bKey) : undefined}
            onDragLeave={handleExDragLeave}
            onDrop={canReorderExercises ? (e) => handleExDrop(e, bKey) : undefined}
            className={canReorderExercises && exDropTargetId === bKey ? "ring-2 ring-primary rounded-lg" : ""}
          >
            <Card className={exDragId === bKey ? "opacity-60" : ""}>
              <CardHeader
                className="cursor-pointer py-4"
                onClick={() => setExpandedKey(isExpanded ? null : bKey)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1 min-w-0 flex-1">
                    {canReorderExercises && (
                      <div
                        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground touch-none mt-0.5"
                        draggable
                        onDragStart={(e) => handleExDragStart(e, bKey)}
                        onDragEnd={handleExDragEnd}
                        onClick={(e) => e.stopPropagation()}
                        aria-hidden
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{displayName}</CardTitle>
                  <RepRangeDisplay
                    exerciseId={ex.id}
                    targetReps={ex.templateSets?.[0]?.targetReps ?? null}
                    targetRepsMin={ex.templateSets?.[0]?.targetRepsMin ?? null}
                    editingExId={editingRepRangeExId}
                    editingMin={editingRepRangeMin}
                    editingMax={editingRepRangeMax}
                    onStartEdit={(id, min, max) => { setEditingRepRangeExId(id); setEditingRepRangeMin(min); setEditingRepRangeMax(max); }}
                    onSave={handleSaveRepRange}
                    onCancel={() => setEditingRepRangeExId(null)}
                    onChangeMin={setEditingRepRangeMin}
                    onChangeMax={setEditingRepRangeMax}
                  />
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
                        <option value="">Original: {safeExerciseName(ex.name)}</option>
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
                            className="h-8 w-full sm:w-40 text-sm"
                            placeholder="Exercise name"
                            value={customReplaceValue}
                            onChange={(e) => setCustomReplaceValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void setExerciseDisplay(ex.id, customReplaceValue);
                            }}
                            onBlur={(e) => {
                              // Don't auto-save on blur — let the Save button handle it to avoid
                              // the blur-before-click race on mobile (iOS fires blur before onClick)
                              if (!e.relatedTarget) setCustomReplaceExId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => void setExerciseDisplay(ex.id, customReplaceValue)}
                          >
                            Save
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {isExpanded && (
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Superset with
                      </span>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-0 max-w-[min(100%,220px)]"
                        value=""
                        onChange={(e) => {
                          const pid = e.target.value;
                          if (pid) void handleCreateSuperset(ex.id, pid);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Choose from this workout…</option>
                        {exercises
                          .filter((o) => o.id !== ex.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {overridesByExercise[o.id] ?? safeExerciseName(o.name)}
                            </option>
                          ))}
                      </select>
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
                      href={`/history/name/${encodeURIComponent(safeExerciseName(ex.name))}`}
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
                    const canDelete = setId && (existing ? true : orderedSetIds.length > 1);
                    const onDelete = existing
                      ? () => handleDeleteLoggedSet(existing.id, ex.id, tmpl.setNumber)
                      : () => handleDeleteTemplateSet(setId, ex.id, safeExerciseName(ex.name));
                    const rowContent = (
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
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={onDelete}
                            aria-label="Delete this set"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                    if (canDelete) {
                      return (
                        <SwipeToDeleteRow
                          key={setId || `set-${tmpl.setNumber}`}
                          onDelete={onDelete}
                          className="rounded-lg"
                        >
                          {rowContent}
                        </SwipeToDeleteRow>
                      );
                    }
                    return rowContent;
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleAddSet(ex.id, safeExerciseName(ex.name))}
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            {lastSavedAt ? (
              <>
                <Check className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                <span>Changes saved.</span>
              </>
            ) : (
              <span>Tap &quot;Log&quot; on each set to save.</span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none">
            <div
              role="switch"
              aria-checked={isDeload}
              onClick={() => void handleToggleDeload(!isDeload)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDeload ? "bg-amber-400" : "bg-input"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isDeload ? "translate-x-6" : "translate-x-1"}`}
              />
            </div>
            <span className={`text-sm font-medium ${isDeload ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              Deload
            </span>
          </label>
        </div>
        {isDeload && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
            Deload mode — sets are logged but excluded from history and progression charts.
          </p>
        )}
      </div>
    </div>
  );
}

function RepRangeDisplay({
  exerciseId,
  targetReps,
  targetRepsMin,
  editingExId,
  editingMin,
  editingMax,
  onStartEdit,
  onSave,
  onCancel,
  onChangeMin,
  onChangeMax,
}: {
  exerciseId: string;
  targetReps: number | null;
  targetRepsMin: number | null;
  editingExId: string | null;
  editingMin: string;
  editingMax: string;
  onStartEdit: (id: string, min: string, max: string) => void;
  onSave: (id: string, min: string, max: string) => Promise<void>;
  onCancel: () => void;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}) {
  const isEditing = editingExId === exerciseId;
  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground shrink-0">Rep range:</span>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          className="h-8 w-14 text-sm px-2"
          placeholder="min"
          value={editingMin}
          onChange={(e) => onChangeMin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave(exerciseId, editingMin, editingMax);
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          className="h-8 w-14 text-sm px-2"
          placeholder="max"
          value={editingMax}
          onChange={(e) => onChangeMax(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave(exerciseId, editingMin, editingMax);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={(e) => {
            if (!e.relatedTarget) void onSave(exerciseId, editingMin, editingMax);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-3 text-xs"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => void onSave(exerciseId, editingMin, editingMax)}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }
  const label = repRangeLabel(targetReps, targetRepsMin);
  return (
    <button
      type="button"
      className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group"
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit(
          exerciseId,
          targetRepsMin != null ? String(targetRepsMin) : "",
          targetReps != null ? String(targetReps) : ""
        );
      }}
    >
      {label ? (
        <>
          <span>Rep range: {label}</span>
          <span className="opacity-0 group-hover:opacity-60 text-[10px]">(edit)</span>
        </>
      ) : (
        <span className="opacity-50 group-hover:opacity-100">+ set rep target</span>
      )}
    </button>
  );
}

function SetRow({
  setNumber,
  hideSetNumber,
  targetReps,
  targetWeight,
  targetRir,
  initialReps,
  initialWeight,
  initialRir,
  onLog,
}: {
  setNumber: number;
  /** When true, set index is only exposed to screen readers (e.g. superset mobile stack with a Set N header). */
  hideSetNumber?: boolean;
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
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3 min-w-0">
      {hideSetNumber ? (
        <span className="sr-only">Set {setNumber}</span>
      ) : (
        <span className="w-8 shrink-0 text-sm font-medium text-muted-foreground">{setNumber}</span>
      )}
      <div className="flex-1 min-w-[80px]">
        <Label className="text-xs">Reps</Label>
        <div className="flex items-center gap-0.5 mt-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 hidden md:flex"
            onClick={() => setReps((r) => dec(r, 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={targetReps != null ? String(targetReps) : "—"}
            value={reps != null ? String(reps) : ""}
            onChange={(e) => setReps(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="h-9 flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 hidden md:flex"
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
            className="h-9 w-9 shrink-0 hidden md:flex"
            onClick={() => setWeight((w) => dec(w ?? 0, 2.5, 0))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            placeholder={targetWeight != null ? String(targetWeight) : "—"}
            value={weight != null ? String(weight) : ""}
            onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
            className="h-9 flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 hidden md:flex"
            onClick={() => setWeight((w) => inc(w ?? 0, 2.5))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="w-16 shrink-0">
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
