"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SwipeToDeleteRow } from "@/components/swipe-to-delete";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SetRecord = {
  id: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  completedAt: string;
  workoutSession?: {
    workoutDay?: {
      week?: { program?: { name: string } };
    };
  };
};

type ProfileContext = {
  weightLb: number | null;
  bodyFatPct: number | null;
  heightCm: number | null;
  age: number | null;
  logDate?: string | null;
} | null;

type BodyLogEntry = { date: string; weightLb: number | null };

function getClosestWeightLb(setDate: string, bodyLogs: BodyLogEntry[]): number | null {
  if (bodyLogs.length === 0) return null;
  const setTime = new Date(setDate).getTime();
  let best = bodyLogs[0];
  let bestDiff = Math.abs(new Date(best.date).getTime() - setTime);
  for (const log of bodyLogs) {
    if (log.weightLb == null) continue;
    const d = Math.abs(new Date(log.date).getTime() - setTime);
    if (d < bestDiff) {
      bestDiff = d;
      best = log;
    }
  }
  return best.weightLb;
}

/** True if exercise is typically bodyweight (dips, pull-ups, etc.) where logged weight is an offset: 0 = BW, + = weighted, - = assisted. */
function isBodyweightExercise(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("dip") ||
    n.includes("pull-up") ||
    n.includes("pullup") ||
    n.includes("chin-up") ||
    n.includes("chinup") ||
    n.includes("push-up") ||
    n.includes("pushup")
  );
}

/** Effective load for volume: bodyweight exercises use BW + offset (positive = add, negative = subtract); others use logged weight or BW when 0. */
function getEffectiveWeight(
  loggedWeight: number | null | undefined,
  setDate: string,
  bodyLogs: BodyLogEntry[],
  exerciseName: string
): number | null {
  const bw = getClosestWeightLb(setDate, bodyLogs);
  if (isBodyweightExercise(exerciseName)) {
    const offset = loggedWeight ?? 0;
    const effective = (bw ?? 0) + offset;
    return effective > 0 ? effective : null;
  }
  if (loggedWeight != null && loggedWeight !== 0) return loggedWeight;
  return bw;
}

/** Movement pattern from exercise name for context-aware advice. */
function getMovementContext(name: string): {
  pattern: "horizontal-push" | "vertical-push" | "squat" | "hinge" | "horizontal-pull" | "vertical-pull" | "isolation" | "other";
  isCompound: boolean;
  isBodyweight: boolean;
} {
  const n = name.toLowerCase();
  const isBodyweight = isBodyweightExercise(name);
  if (n.includes("bench") || n.includes("push-up") || n.includes("pushup") || n.includes("chest press")) {
    return { pattern: "horizontal-push", isCompound: true, isBodyweight: n.includes("push-up") || n.includes("pushup") };
  }
  if (n.includes("overhead") || n.includes("ohp") || n.includes("strict press") || n.includes("military press") || (n.includes("press") && !n.includes("bench")) || n.includes("dip")) {
    return { pattern: "vertical-push", isCompound: true, isBodyweight: n.includes("dip") };
  }
  if (n.includes("squat") || n.includes("lunge") || n.includes("leg press")) {
    return { pattern: "squat", isCompound: !n.includes("leg press"), isBodyweight: false };
  }
  if (n.includes("deadlift") || n.includes("rdl") || n.includes("romanian") || n.includes("hip hinge") || n.includes("good morning")) {
    return { pattern: "hinge", isCompound: true, isBodyweight: false };
  }
  if (n.includes("row") || n.includes("t-bar") || n.includes("cable row") || n.includes("pendlay")) {
    return { pattern: "horizontal-pull", isCompound: true, isBodyweight: false };
  }
  if (n.includes("pull-up") || n.includes("pullup") || n.includes("chin-up") || n.includes("chinup") || n.includes("lat pull") || n.includes("pulldown")) {
    return { pattern: "vertical-pull", isCompound: true, isBodyweight: n.includes("pull-up") || n.includes("pullup") || n.includes("chin") };
  }
  if (n.includes("curl") || n.includes("extension") || n.includes("fly") || n.includes("raise") || n.includes("tricep") || n.includes("bicep") || n.includes("lateral") || n.includes("calf")) {
    return { pattern: "isolation", isCompound: false, isBodyweight: false };
  }
  return { pattern: "other", isCompound: false, isBodyweight };
}

/** Movement-specific plateau advice when progress has stalled. */
function getPlateauAdvice(
  exerciseName: string,
  movement: ReturnType<typeof getMovementContext>,
  topWeight: number
): string {
  const { pattern, isCompound, isBodyweight } = movement;
  const weightStr = topWeight % 1 === 0 ? `${Math.round(topWeight)}` : `${topWeight}`;
  if (isBodyweight) {
    return `For ${exerciseName}, try adding load (weight vest or dip belt) or progressing to a harder progression (e.g. weighted rep, slower tempo, or a more demanding variation).`;
  }
  switch (pattern) {
    case "horizontal-push":
      return `For ${exerciseName}, try adding 2.5–5 lb to the bar next session, or aim for 1–2 more reps on your top set before adding weight. If you're at a plateau, a back-off set at 85–90% can help accumulate volume.`;
    case "vertical-push":
      return `For ${exerciseName}, small jumps (2.5 lb) add up. Alternatively, add an extra set in the 6–8 rep range or push for one more rep on your heaviest set before increasing load.`;
    case "squat":
      return `For ${exerciseName}, consider a 5 lb jump if you've been stuck for several sessions, or add one set in the 6–8 range. Varying rep ranges (e.g. a heavier 3–5 day and a volume 8–10 day) can also break plateaus.`;
    case "hinge":
      return `For ${exerciseName}, deadlifts and hinges respond to small load increases (5–10 lb) or an extra working set. If recovery is good, one more heavy set or a slight rep increase on top sets can restart progress.`;
    case "horizontal-pull":
    case "vertical-pull":
      return `For ${exerciseName}, add 2.5–5 lb when you can complete your target reps with good form, or add one back-off set. Focus on full range of motion and a slight rep increase before adding weight.`;
    case "isolation":
      return `For ${exerciseName}, progress by adding 2.5–5 lb, one extra set, or 1–2 more reps per set. Isolation work benefits from consistent small increments.`;
    default:
      return `For ${exerciseName}, try a small weight increase (2.5–5 lb) or aim for 1–2 more reps on your top set. Adding one extra set can also help break a plateau.`;
  }
}

const CHUNK_SIZE = 20;
const TIMEFRAME_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "Past year" },
] as const;

export function HistoryDetailClient({
  exerciseName,
  sets,
  bodyLogs = [],
  profileContext,
}: {
  exerciseName: string;
  sets: SetRecord[];
  bodyLogs?: BodyLogEntry[];
  profileContext?: ProfileContext;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [timeframeDays, setTimeframeDays] = useState(365);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set([0]));

  const handleDeleteSet = async (setId: string) => {
    setDeletingId(setId);
    try {
      const res = await fetch(`/api/logged-sets/${setId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const setsFilteredByTimeframe = useMemo(() => {
    if (sets.length === 0) return [];
    const latest = new Date(sets[0].completedAt).getTime();
    const cutoff = latest - timeframeDays * 24 * 60 * 60 * 1000;
    return sets.filter((s) => new Date(s.completedAt).getTime() >= cutoff);
  }, [sets, timeframeDays]);

  const setsWithVolume = useMemo(() => {
    return setsFilteredByTimeframe.filter((s) => {
      const reps = s.reps ?? 0;
      const effectiveWeight = getEffectiveWeight(s.weight, s.completedAt, bodyLogs, exerciseName);
      return reps > 0 && (effectiveWeight ?? 0) > 0;
    });
  }, [setsFilteredByTimeframe, bodyLogs, exerciseName]);

  const byDate = useMemo(() => {
    const acc: Record<string, SetRecord[]> = {};
    for (const s of setsWithVolume) {
      const d = s.completedAt.slice(0, 10);
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
    }
    const dates = Object.keys(acc).sort((a, b) => b.localeCompare(a));
    return { dates, byDate: acc };
  }, [setsWithVolume]);

  /** Epley 1RM: weight * (1 + reps/30) */
  function epley1RM(weight: number, reps: number): number {
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  }

  const chartData = useMemo(() => {
    return byDate.dates
      .slice()
      .reverse()
      .map((date) => {
        const daySets = byDate.byDate[date] ?? [];
        let volume = 0;
        let topWeight = 0;
        let best1RM = 0;
        for (const s of daySets) {
          const effectiveWeight = getEffectiveWeight(s.weight, s.completedAt, bodyLogs, exerciseName);
          const w = effectiveWeight ?? 0;
          const r = s.reps ?? 0;
          volume += r * w;
          if (w > topWeight) topWeight = w;
          if (w > 0 && r > 0) {
            const est = epley1RM(w, r);
            if (est > best1RM) best1RM = est;
          }
        }
        return {
          date,
          label: formatDate(date),
          volume: Math.round(volume),
          topWeight: topWeight > 0 ? Math.round(topWeight * 10) / 10 : null,
          est1RM: best1RM > 0 ? best1RM : null,
        };
      })
      .filter((d) => d.volume > 0);
  }, [byDate, bodyLogs, exerciseName]);

  const volumeDomain = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const volumes = chartData.map((d) => d.volume);
    const dataMin = Math.min(...volumes);
    const dataMax = Math.max(...volumes);
    const range = dataMax - dataMin;
    const padding = range === 0 ? Math.max(dataMin * 0.1, 1) : range * 0.1;
    const yMin = Math.max(0, dataMin - padding);
    const yMax = dataMax + padding;
    return [yMin, yMax] as [number, number];
  }, [chartData]);

  const weightValues = useMemo(
    () => chartData.map((d) => d.topWeight).filter((w): w is number => w != null && w > 0),
    [chartData]
  );
  const weightDomain = useMemo(() => {
    if (weightValues.length === 0) return undefined;
    const dataMin = Math.min(...weightValues);
    const dataMax = Math.max(...weightValues);
    const range = dataMax - dataMin;
    const padding = range === 0 ? Math.max(dataMin * 0.1, 1) : range * 0.1;
    const yMin = Math.max(0, dataMin - padding);
    const yMax = dataMax + padding;
    return [yMin, yMax] as [number, number];
  }, [weightValues]);

  const est1RMValues = useMemo(
    () => chartData.map((d) => d.est1RM).filter((v): v is number => v != null && v > 0),
    [chartData]
  );
  const est1RMDomain = useMemo(() => {
    if (est1RMValues.length === 0) return undefined;
    const dataMin = Math.min(...est1RMValues);
    const dataMax = Math.max(...est1RMValues);
    const range = dataMax - dataMin;
    const padding = range === 0 ? Math.max(dataMin * 0.1, 1) : range * 0.1;
    const yMin = Math.max(0, dataMin - padding);
    const yMax = dataMax + padding;
    return [yMin, yMax] as [number, number];
  }, [est1RMValues]);

  const { summaryText, insightText } = useMemo(() => {
    const totalVolume = setsWithVolume.reduce((sum, s) => {
      const effectiveWeight = getEffectiveWeight(s.weight, s.completedAt, bodyLogs, exerciseName);
      return sum + (s.reps ?? 0) * (effectiveWeight ?? 0);
    }, 0);
    const sessionCount = byDate.dates.length;
    const avgVolume = sessionCount > 0 ? totalVolume / sessionCount : 0;
    const recent = chartData.slice(-5);
    const trend =
      recent.length >= 2 && recent[recent.length - 1].volume > recent[0].volume
        ? "up"
        : recent.length >= 2 && recent[recent.length - 1].volume < recent[0].volume
          ? "down"
          : "stable";

    const lines: string[] = [];
    lines.push(`${exerciseName}: ${sessionCount} session${sessionCount === 1 ? "" : "s"} logged.`);
    lines.push(`Total volume: ${Math.round(totalVolume).toLocaleString()} lb. Avg per session: ${Math.round(avgVolume).toLocaleString()} lb.`);

    const weightsWithData = chartData.map((d) => d.topWeight).filter((w): w is number => w != null && w > 0);
    if (weightsWithData.length >= 2) {
      const firstWeight = weightsWithData[0];
      const lastWeight = weightsWithData[weightsWithData.length - 1];
      const weightDelta = lastWeight - firstWeight;
      const weightPct = firstWeight > 0 ? Math.round((weightDelta / firstWeight) * 100) : 0;
      if (weightDelta > 0) {
        lines.push(`Top weight progression: ${firstWeight} → ${lastWeight} lb (+${weightDelta} lb${weightPct !== 0 ? `, +${weightPct}%` : ""}).`);
      } else if (weightDelta < 0) {
        lines.push(`Top weight: ${firstWeight} → ${lastWeight} lb (${weightDelta} lb).`);
      } else {
        lines.push(`Top weight stable at ${lastWeight} lb.`);
      }
    } else if (weightsWithData.length === 1) {
      lines.push(`Top weight: ${weightsWithData[0]} lb.`);
    }
    const summaryText = lines.join(" ");

    const recentDates = byDate.dates.slice(0, Math.min(5, byDate.dates.length));
    const olderDates = byDate.dates.slice(recentDates.length);
    const getMaxWeightAndReps = (dateList: string[]) => {
      let maxW = 0;
      let maxR = 0;
      for (const d of dateList) {
        const daySets = byDate.byDate[d] ?? [];
        for (const s of daySets) {
          const effectiveWeight = getEffectiveWeight(s.weight, s.completedAt, bodyLogs, exerciseName);
          if (effectiveWeight != null && effectiveWeight > maxW) maxW = effectiveWeight;
          const r = s.reps ?? 0;
          if (r > maxR) maxR = r;
        }
      }
      return { maxWeight: maxW, maxReps: maxR };
    };
    const recentMax = getMaxWeightAndReps(recentDates);
    const olderMax = getMaxWeightAndReps(olderDates);
    const weightUp = recentMax.maxWeight > olderMax.maxWeight;
    const repsUp = recentMax.maxReps > olderMax.maxReps;
    const weightOrRepsUp = weightUp || repsUp;

    const recentVolumes = recent.map((d) => d.volume);
    const olderVolumes = chartData.slice(0, -recent.length).map((d) => d.volume);
    const recentAvgVol = recentVolumes.length > 0 ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length : 0;
    const olderAvgVol = olderVolumes.length > 0 ? olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length : recentAvgVol;
    const volumePctChange = olderAvgVol > 0 ? ((recentAvgVol - olderAvgVol) / olderAvgVol) * 100 : 0;

    const recentWeights = recent.map((d) => d.topWeight).filter((w): w is number => w != null && w > 0);
    const olderWeights = chartData.slice(0, -recent.length).map((d) => d.topWeight).filter((w): w is number => w != null && w > 0);
    const recentTop = recentWeights.length > 0 ? Math.max(...recentWeights) : 0;
    const olderTop = olderWeights.length > 0 ? Math.max(...olderWeights) : 0;
    const weightDelta = recentTop - olderTop;
    const weightPctChange = olderTop > 0 ? (weightDelta / olderTop) * 100 : 0;

    const movement = getMovementContext(exerciseName);
    const nRecent = recent.length;
    const isPlateau = nRecent >= 2 && !weightOrRepsUp && Math.abs(volumePctChange) < 5;

    let insightText = "";
    if (sessionCount < 2) {
      insightText = "Log a few more sessions to get progression insight.";
    } else if (isPlateau) {
      const currentTop = recentTop > 0 ? recentTop : olderTop;
      const advice = getPlateauAdvice(exerciseName, movement, currentTop);
      insightText = `${exerciseName} has stayed at ${currentTop} lb for the last ${nRecent} session${nRecent === 1 ? "" : "s"} with similar volume and reps — progress has stalled on this movement. ${advice}`;
    } else if (trend === "up") {
      const volDesc = volumePctChange >= 15
        ? `volume is up ${Math.round(volumePctChange)}%`
        : volumePctChange >= 5
          ? `volume is up ${Math.round(volumePctChange)}%`
          : "volume is inching up";
      if (weightDelta > 0) {
        const pctPart = olderTop > 0 && Number.isFinite(weightPctChange) && Math.abs(weightPctChange) >= 1
          ? `, ${weightPctChange > 0 ? "+" : ""}${Math.round(weightPctChange)}%`
          : "";
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"}, ${exerciseName} went from ${olderTop} to ${recentTop} lb (+${weightDelta} lb${pctPart}) and ${volDesc}. You're progressing both load and volume — keep adding weight or reps gradually to sustain it.`;
      } else {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"} on ${exerciseName}, ${volDesc}. Focus on adding a small amount of weight or 1–2 more reps on your top set next block to keep overloading.`;
      }
    } else if (trend === "down") {
      if (weightUp && olderTop > 0) {
        const volDesc = volumePctChange < -5 ? `Volume dropped ${Math.round(Math.abs(volumePctChange))}% while ` : "";
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"}, ${volDesc}top weight on ${exerciseName} went from ${olderTop} to ${recentTop} lb (+${weightDelta} lb). You're lifting heavier per set — that's progressive overload; the dip in volume reflects the heavier load. Keep building strength at this weight before adding more.`;
      } else if (repsUp && !weightUp) {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"}, volume on ${exerciseName} dipped but you're getting more reps at similar weight. You're progressing in work capacity; next step is to add weight (2.5–5 lb) so those extra reps translate into load progression.`;
      } else if (weightOrRepsUp) {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"} on ${exerciseName}, volume is down but you're lifting heavier or doing more reps. You're trading total volume for intensity — keep pushing the weight or rep target on your top sets.`;
      } else {
        insightText = `Volume on ${exerciseName} is down over the last ${nRecent} session${nRecent === 1 ? "" : "s"} with no increase in weight or reps. If this isn't a planned deload, consider a lighter week or checking recovery before pushing load again.`;
      }
    } else {
      if (weightUp && olderTop > 0) {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"}, volume on ${exerciseName} is flat but top weight went from ${olderTop} to ${recentTop} lb (+${weightDelta} lb). Same or less volume at higher load means you're getting stronger — that's effective progressive overload.`;
      } else if (repsUp) {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"} on ${exerciseName}, volume is flat and you're hitting more reps. You're progressing; add 2.5–5 lb next so the overload continues.`;
      } else if (weightOrRepsUp) {
        insightText = `Over the last ${nRecent} session${nRecent === 1 ? "" : "s"} on ${exerciseName}, volume is steady and weight or reps are up. You're applying progressive overload — keep adding small increments in load or reps.`;
      } else {
        insightText = `${exerciseName} has held steady in volume and load over the last ${nRecent} session${nRecent === 1 ? "" : "s"}. ${getPlateauAdvice(exerciseName, movement, recentTop > 0 ? recentTop : olderTop)}`;
      }
    }
    return { summaryText, insightText };
  }, [exerciseName, setsWithVolume, byDate, chartData, bodyLogs]);

  const profileLine = profileContext && (profileContext.weightLb != null || profileContext.bodyFatPct != null)
    ? `Your latest log${profileContext.logDate ? ` (${formatDate(profileContext.logDate)})` : ""}: ${profileContext.weightLb != null ? `${profileContext.weightLb} lb` : ""}${profileContext.weightLb != null && profileContext.bodyFatPct != null ? ", " : ""}${profileContext.bodyFatPct != null ? `${profileContext.bodyFatPct}% body fat` : ""}.`
    : null;

  const allSetsOrdered = useMemo(
    () => [...sets].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
    [sets]
  );
  const chunks = useMemo(() => {
    const result: SetRecord[][] = [];
    for (let i = 0; i < allSetsOrdered.length; i += CHUNK_SIZE) {
      result.push(allSetsOrdered.slice(i, i + CHUNK_SIZE));
    }
    return result;
  }, [allSetsOrdered]);

  const toggleChunk = (idx: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* On mobile: chart/summary first (order-1), history second (order-2). On lg: natural order. */}
      <div className="lg:col-span-2 space-y-3 order-2 lg:order-1">
        <p className="text-sm font-semibold text-muted-foreground">Logged sets (newest first)</p>
        {chunks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No sets logged yet.</p>
        ) : (
          chunks.map((chunk, idx) => {
            const isExpanded = expandedChunks.has(idx);
            const start = idx * CHUNK_SIZE + 1;
            const end = idx * CHUNK_SIZE + chunk.length;
            const dateRange =
              chunk.length > 0
                ? `${formatDate(chunk[chunk.length - 1].completedAt)} – ${formatDate(chunk[0].completedAt)}`
                : "";
            return (
              <div key={idx} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleChunk(idx)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span>Sets {start}–{end}</span>
                  <span className="text-muted-foreground text-xs">({dateRange})</span>
                </button>
                {isExpanded && (
                  <ul className="space-y-1 px-3 pb-3">
                    {chunk.map((s) => (
                      <li key={s.id}>
                        <SwipeToDeleteRow
                          onDelete={() => handleDeleteSet(s.id)}
                          disabled={deletingId === s.id}
                          className="rounded-md"
                        >
                          <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 px-2 -mx-2">
                            <span className="text-muted-foreground">Set {s.setNumber}</span>
                            <span>
                              {s.reps ?? "—"}×{s.weight ?? "—"} lb
                              {s.rir != null ? ` RIR${s.rir}` : ""}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(s.completedAt)}
                            </span>
                            {s.workoutSession?.workoutDay?.week?.program?.name && (
                              <span className="text-muted-foreground truncate">
                                · {s.workoutSession.workoutDay.week.program.name}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0 hidden md:inline-flex ml-auto"
                              onClick={() => handleDeleteSet(s.id)}
                              disabled={deletingId === s.id}
                              aria-label="Delete this set"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </SwipeToDeleteRow>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="space-y-2 order-1 lg:order-2">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-muted-foreground">Volume (weight × reps) by session</p>
              <select
                value={timeframeDays}
                onChange={(e) => setTimeframeDays(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 42, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    yAxisId="volume"
                    domain={volumeDomain}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v}`}
                  />
                  {(weightValues.length > 0 || est1RMValues.length > 0) && (
                    <YAxis
                      yAxisId="weight"
                      orientation="right"
                      domain={est1RMValues.length > 0 ? est1RMDomain : weightDomain}
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => `${v} lb`}
                    />
                  )}
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "volume") return [`${value} lb`, "Volume"];
                      if (name === "topWeight") return [value != null ? `${value} lb` : "—", "Top weight"];
                      if (name === "est1RM") return [value != null ? `${value} lb` : "—", "Est. 1RM"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => (value === "volume" ? "Volume" : value === "topWeight" ? "Top weight" : value === "est1RM" ? "Est. 1RM" : value)}
                  />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="volume"
                    name="volume"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  {weightValues.length > 0 && (
                    <Line
                      yAxisId="weight"
                      type="monotone"
                      dataKey="topWeight"
                      name="topWeight"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  )}
                  {est1RMValues.length > 0 && (
                    <Line
                      yAxisId="weight"
                      type="monotone"
                      dataKey="est1RM"
                      name="est1RM"
                      stroke="hsl(38, 92%, 50%)"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No volume data yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Summary ({TIMEFRAME_OPTIONS.find((o) => o.value === timeframeDays)?.label ?? timeframeDays + " days"})
            </p>
            <p className="text-sm">{summaryText}</p>
            <p className="text-sm font-medium text-primary mt-2">{insightText}</p>
            {profileLine && (
              <p className="text-sm text-muted-foreground mt-2">{profileLine}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
