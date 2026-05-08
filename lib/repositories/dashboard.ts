import { prisma } from "@/lib/db";

function epley(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function lastNWeeks(n: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const k = isoWeekKey(d);
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return keys;
}

export type DashboardData = {
  hasData: boolean;
  healthScore: {
    total: number;
    consistency: number;
    volumeTrend: number;
    strengthTrend: number;
    intensity: number;
    consistencyLabel: string;
    volumeLabel: string;
    strengthLabel: string;
    intensityLabel: string;
  };
  recentActivity: {
    sessionsLast14: number;
    setsLast14: number;
    prsLast14: number;
  };
  weeklyVolume: { week: string; volume: number }[];
  exerciseOneRM: { name: string; data: { week: string; orm: number | null }[] }[];
  insights: {
    topMomentum: { name: string; improvement: number }[];
    stalling: { name: string; weeks: number }[];
    deloadDue: { name: string; streak: number }[];
  };
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const sets = await prisma.loggedSet.findMany({
    where: {
      completedAt: { gte: twelveWeeksAgo },
      isWarmup: { not: true },
      reps: { not: null },
      weight: { not: null },
      workoutSession: {
        is: {
          isDeload: false,
          workoutDay: { week: { program: { userId } } },
        },
      },
    },
    select: {
      reps: true,
      weight: true,
      rir: true,
      completedAt: true,
      exercise: { select: { name: true } },
      workoutSession: { select: { id: true, startedAt: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  if (sets.length === 0) {
    const weeks = lastNWeeks(12);
    return {
      hasData: false,
      healthScore: { total: 0, consistency: 0, volumeTrend: 0, strengthTrend: 0, intensity: 0, consistencyLabel: "No data", volumeLabel: "No data", strengthLabel: "No data", intensityLabel: "No data" },
      recentActivity: { sessionsLast14: 0, setsLast14: 0, prsLast14: 0 },
      weeklyVolume: weeks.map(w => ({ week: w, volume: 0 })),
      exerciseOneRM: [],
      insights: { topMomentum: [], stalling: [], deloadDue: [] },
    };
  }

  const weeks = lastNWeeks(12);

  // Build weekly buckets
  const weeklyVolumeMap: Record<string, number> = {};
  const weeklyExOrm: Record<string, Record<string, number>> = {};
  const exSetCount: Record<string, number> = {};

  for (const s of sets) {
    if (s.reps == null || s.weight == null) continue;
    const w = isoWeekKey(new Date(s.completedAt));
    weeklyVolumeMap[w] = (weeklyVolumeMap[w] ?? 0) + s.weight * s.reps;
    const orm = epley(s.weight, s.reps);
    if (!weeklyExOrm[w]) weeklyExOrm[w] = {};
    const name = s.exercise.name;
    weeklyExOrm[w][name] = Math.max(weeklyExOrm[w][name] ?? 0, orm);
    exSetCount[name] = (exSetCount[name] ?? 0) + 1;
  }

  const weeklyVolume = weeks.map(w => ({ week: w, volume: Math.round(weeklyVolumeMap[w] ?? 0) }));

  // Top 5 exercises by set count
  const topExercises = Object.entries(exSetCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const exerciseOneRM = topExercises.map(name => ({
    name,
    data: weeks.map(w => ({
      week: w,
      orm: weeklyExOrm[w]?.[name] != null ? Math.round(weeklyExOrm[w][name]) : null,
    })),
  }));

  // Health score
  // Consistency
  const sessionDays = new Set<string>();
  for (const s of sets) {
    if (new Date(s.completedAt) >= twentyEightDaysAgo) {
      sessionDays.add(new Date(s.workoutSession.startedAt).toISOString().slice(0, 10));
    }
  }
  const consistencySessions = sessionDays.size;
  const consistencyScore = Math.min(25, Math.round((consistencySessions / 12) * 25));

  // Volume trend
  const last2 = weeks.slice(-2);
  const prev2 = weeks.slice(-4, -2);
  const currVol = last2.reduce((s, w) => s + (weeklyVolumeMap[w] ?? 0), 0);
  const prevVol = prev2.reduce((s, w) => s + (weeklyVolumeMap[w] ?? 0), 0);
  let volumeScore = 12;
  let volumeLabel = "Stable";
  if (prevVol > 0) {
    const r = currVol / prevVol;
    if (r >= 1.1) { volumeScore = 25; volumeLabel = "Improving"; }
    else if (r >= 0.9) { volumeScore = 18; volumeLabel = "Stable"; }
    else if (r >= 0.75) { volumeScore = 10; volumeLabel = "Dipping"; }
    else { volumeScore = 4; volumeLabel = "Declining"; }
  }

  // Strength trend
  const strengthDeltas: number[] = [];
  for (const name of topExercises) {
    const curr = last2.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
    const prev = prev2.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
    if (!curr.length || !prev.length) continue;
    const delta = (Math.max(...curr) - Math.max(...prev)) / Math.max(...prev);
    strengthDeltas.push(delta);
  }
  const avgDelta = strengthDeltas.length ? strengthDeltas.reduce((a, b) => a + b) / strengthDeltas.length : 0;
  let strengthScore = 12;
  let strengthLabel = "Stable";
  if (strengthDeltas.length) {
    if (avgDelta >= 0.03) { strengthScore = 25; strengthLabel = "Improving"; }
    else if (avgDelta >= 0) { strengthScore = 18; strengthLabel = "Holding"; }
    else if (avgDelta >= -0.03) { strengthScore = 10; strengthLabel = "Slight decline"; }
    else { strengthScore = 4; strengthLabel = "Declining"; }
  }

  // Intensity
  const recentRirs: number[] = [];
  for (const s of sets) {
    if (new Date(s.completedAt) >= fourteenDaysAgo && s.rir != null) {
      recentRirs.push(s.rir);
    }
  }
  const avgRir = recentRirs.length ? recentRirs.reduce((a, b) => a + b) / recentRirs.length : null;
  let intensityScore = 12;
  let intensityLabel = "No RIR data";
  if (avgRir != null) {
    if (avgRir <= 1) { intensityScore = 25; intensityLabel = `Avg RIR ${avgRir.toFixed(1)} — very high`; }
    else if (avgRir <= 2) { intensityScore = 20; intensityLabel = `Avg RIR ${avgRir.toFixed(1)} — high`; }
    else if (avgRir <= 3) { intensityScore = 14; intensityLabel = `Avg RIR ${avgRir.toFixed(1)} — moderate`; }
    else { intensityScore = 7; intensityLabel = `Avg RIR ${avgRir.toFixed(1)} — low`; }
  }

  const healthScore = {
    total: consistencyScore + volumeScore + strengthScore + intensityScore,
    consistency: consistencyScore,
    volumeTrend: volumeScore,
    strengthTrend: strengthScore,
    intensity: intensityScore,
    consistencyLabel: `${consistencySessions} sessions / 28 days`,
    volumeLabel,
    strengthLabel,
    intensityLabel,
  };

  // Recent activity
  const recentSets = sets.filter(s => new Date(s.completedAt) >= fourteenDaysAgo);
  const recentSessionDays = new Set(recentSets.map(s => new Date(s.workoutSession.startedAt).toISOString().slice(0, 10)));

  // PRs: exercises where recent max 1RM exceeds historical max
  const historicalOrm: Record<string, number> = {};
  const recentOrm: Record<string, number> = {};
  for (const s of sets) {
    if (s.reps == null || s.weight == null) continue;
    const orm = epley(s.weight, s.reps);
    const name = s.exercise.name;
    if (new Date(s.completedAt) >= fourteenDaysAgo) {
      recentOrm[name] = Math.max(recentOrm[name] ?? 0, orm);
    } else {
      historicalOrm[name] = Math.max(historicalOrm[name] ?? 0, orm);
    }
  }
  let prs = 0;
  for (const [name, val] of Object.entries(recentOrm)) {
    if (val > (historicalOrm[name] ?? 0) * 1.005) prs++;
  }

  const recentActivity = {
    sessionsLast14: recentSessionDays.size,
    setsLast14: recentSets.length,
    prsLast14: prs,
  };

  // Insights
  const last4 = weeks.slice(-4);
  const prior4 = weeks.slice(-8, -4);
  const allExNames = Object.keys(exSetCount);

  const momentumItems: { name: string; improvement: number }[] = [];
  const stallingItems: { name: string; weeks: number }[] = [];
  const deloadItems: { name: string; streak: number }[] = [];

  for (const name of allExNames) {
    const last4vals = last4.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
    const prior4vals = prior4.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);

    if (last4vals.length === 0) continue;

    if (prior4vals.length > 0) {
      const lastMax = Math.max(...last4vals);
      const priorMax = Math.max(...prior4vals);
      const improvement = (lastMax - priorMax) / priorMax;
      if (improvement > 0.01) momentumItems.push({ name, improvement });
      // Stalling: 3+ recent weeks of data but essentially flat
      if (last4vals.length >= 3) {
        const sorted = [...last4vals];
        const range = Math.max(...sorted) - Math.min(...sorted);
        const avg = sorted.reduce((a, b) => a + b) / sorted.length;
        if (range / avg < 0.02) stallingItems.push({ name, weeks: last4vals.length });
      }
    }

    // Deload due: consecutive weeks active
    let streak = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeklyExOrm[weeks[i]]?.[name] != null) streak++;
      else break;
    }
    if (streak >= 6) deloadItems.push({ name, streak });
  }

  momentumItems.sort((a, b) => b.improvement - a.improvement);
  stallingItems.sort((a, b) => b.weeks - a.weeks);
  deloadItems.sort((a, b) => b.streak - a.streak);

  return {
    hasData: true,
    healthScore,
    recentActivity,
    weeklyVolume,
    exerciseOneRM,
    insights: {
      topMomentum: momentumItems.slice(0, 4),
      stalling: stallingItems.slice(0, 4),
      deloadDue: deloadItems.slice(0, 4),
    },
  };
}
