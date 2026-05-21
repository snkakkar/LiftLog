import { prisma } from "@/lib/db";
import { estimateOneRepMax, effectiveVolume } from "@/lib/strength/oneRepMax";

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
  /** Human-readable breakdowns shown in the score detail dialog. */
  scoreBreakdown: {
    consistency: {
      sessions: number;
      windowDays: number;
      targetSessions: number;
      sessionDates: string[];
    };
    volumeTrend: {
      currentTwoWeekVolume: number;
      previousTwoWeekVolume: number;
      changePct: number | null;
    };
    strengthTrend: {
      avgChangePct: number | null;
      perExercise: { name: string; recentBest: number; previousBest: number; changePct: number }[];
    };
    intensity: {
      avgRir: number | null;
      sampleSize: number;
      programSets: number;
      activitySessions: number;
    };
  };
  recentActivity: {
    sessionsLast14: number;
    setsLast14: number;
    prsLast14: number;
    sessionDates: string[];
    prExercises: { name: string; recentOrm: number; previousBest: number }[];
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

  const [sets, activitySessions] = await Promise.all([
    prisma.loggedSet.findMany({
      where: {
        completedAt: { gte: twelveWeeksAgo },
        isWarmup: { not: true },
        isFormDeload: { not: true },
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
        isWarmup: true,
        isFormDeload: true,
        completedAt: true,
        exercise: { select: { name: true } },
        workoutSession: { select: { id: true, startedAt: true } },
      },
      orderBy: { completedAt: "asc" },
    }),
    prisma.activitySession.findMany({
      where: { userId, startedAt: { gte: twelveWeeksAgo } },
      select: { startedAt: true, rpe: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  if (sets.length === 0 && activitySessions.length === 0) {
    const weeks = lastNWeeks(12);
    return {
      hasData: false,
      healthScore: { total: 0, consistency: 0, volumeTrend: 0, strengthTrend: 0, intensity: 0, consistencyLabel: "No data", volumeLabel: "No data", strengthLabel: "No data", intensityLabel: "No data" },
      scoreBreakdown: {
        consistency: { sessions: 0, windowDays: 28, targetSessions: 16, sessionDates: [] },
        volumeTrend: { currentTwoWeekVolume: 0, previousTwoWeekVolume: 0, changePct: null },
        strengthTrend: { avgChangePct: null, perExercise: [] },
        intensity: { avgRir: null, sampleSize: 0, programSets: 0, activitySessions: 0 },
      },
      recentActivity: { sessionsLast14: 0, setsLast14: 0, prsLast14: 0, sessionDates: [], prExercises: [] },
      weeklyVolume: weeks.map(w => ({ week: w, volume: 0 })),
      exerciseOneRM: [],
      insights: { topMomentum: [], stalling: [], deloadDue: [] },
    };
  }

  const weeks = lastNWeeks(12);

  // Build weekly buckets
  const weeklyVolumeMap: Record<string, number> = {};
  const weeklyExOrm: Record<string, Record<string, number>> = {};
  const exVolume: Record<string, number> = {};

  for (const s of sets) {
    const vol = effectiveVolume(s);
    if (vol === 0) continue;
    const w = isoWeekKey(new Date(s.completedAt));
    weeklyVolumeMap[w] = (weeklyVolumeMap[w] ?? 0) + vol;
    const name = s.exercise.name;
    exVolume[name] = (exVolume[name] ?? 0) + vol;
    const orm = estimateOneRepMax(s);
    if (orm == null) continue;
    if (!weeklyExOrm[w]) weeklyExOrm[w] = {};
    weeklyExOrm[w][name] = Math.max(weeklyExOrm[w][name] ?? 0, orm);
  }

  const weeklyVolume = weeks.map(w => ({ week: w, volume: Math.round(weeklyVolumeMap[w] ?? 0) }));

  // Rank exercises by total effective volume (weight × reps), not raw set count.
  // Volume favors compound lifts (squat, deadlift, press) so all training days are
  // represented even when programming frequency varies week to week. Ranking by
  // raw set count biased the chart toward whichever muscle group happened to get
  // an extra session in the window.
  const exercisesByVolume = Object.entries(exVolume)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // 1RM chart shows the top 5 by volume to stay legible.
  const chartExercises = exercisesByVolume.slice(0, 5);

  const exerciseOneRM = chartExercises.map(name => ({
    name,
    data: weeks.map(w => ({
      week: w,
      orm: weeklyExOrm[w]?.[name] != null ? Math.round(weeklyExOrm[w][name]) : null,
    })),
  }));

  // Health score
  // Consistency: counts unique days in last 28 days that had any logged training —
  // either a program workout (LoggedSet) OR a standalone ActivitySession.
  const sessionDays = new Set<string>();
  for (const s of sets) {
    if (new Date(s.completedAt) >= twentyEightDaysAgo) {
      sessionDays.add(new Date(s.workoutSession.startedAt).toISOString().slice(0, 10));
    }
  }
  for (const a of activitySessions) {
    if (new Date(a.startedAt) >= twentyEightDaysAgo) {
      sessionDays.add(new Date(a.startedAt).toISOString().slice(0, 10));
    }
  }
  const consistencySessions = sessionDays.size;
  // 16 sessions in 28 days (~4×/week) earns the full 25. The previous 12-session
  // target capped out at ~3×/week, so anyone training more saw no signal in the score.
  const consistencyScore = Math.min(25, Math.round((consistencySessions / 16) * 25));

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

  // Strength trend: compare recent 4 weeks vs prior 4 weeks. A 2-vs-2 window
  // misses lifts trained on a weekly cadence (most lifts appear in only 1 of 2 weeks),
  // which collapsed the score onto whichever muscle group happened to fall in both windows.
  // Score across all lifts that have data in both windows, not just the top by volume.
  const recent4 = weeks.slice(-4);
  const prior4 = weeks.slice(-8, -4);
  const strengthDeltas: number[] = [];
  const strengthPerExercise: { name: string; recentBest: number; previousBest: number; changePct: number }[] = [];
  for (const name of exercisesByVolume) {
    const curr = recent4.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
    const prev = prior4.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
    if (!curr.length || !prev.length) continue;
    const recentBest = Math.max(...curr);
    const previousBest = Math.max(...prev);
    const delta = (recentBest - previousBest) / previousBest;
    strengthDeltas.push(delta);
    strengthPerExercise.push({ name, recentBest: Math.round(recentBest), previousBest: Math.round(previousBest), changePct: delta });
  }
  // Show the dialog the most-trained lifts first, capped so the list stays readable.
  strengthPerExercise.sort((a, b) => (exVolume[b.name] ?? 0) - (exVolume[a.name] ?? 0));
  const avgDelta = strengthDeltas.length ? strengthDeltas.reduce((a, b) => a + b) / strengthDeltas.length : 0;
  let strengthScore = 12;
  let strengthLabel = "Stable";
  if (strengthDeltas.length) {
    if (avgDelta >= 0.03) { strengthScore = 25; strengthLabel = "Improving"; }
    else if (avgDelta >= 0) { strengthScore = 18; strengthLabel = "Holding"; }
    else if (avgDelta >= -0.03) { strengthScore = 10; strengthLabel = "Slight decline"; }
    else { strengthScore = 4; strengthLabel = "Declining"; }
  }

  // Intensity: combines RIR from program sets with RPE from activity sessions.
  // RPE 1-10 maps to a pseudo-RIR via (10 - rpe), so a hard travel HIIT (RPE 9 ≈ RIR 1)
  // pulls the average toward "high intensity" the same as a near-failure lifting set.
  const recentRirs: number[] = [];
  let intensityProgramSets = 0;
  let intensityActivitySessions = 0;
  for (const s of sets) {
    if (new Date(s.completedAt) >= fourteenDaysAgo && s.rir != null) {
      recentRirs.push(s.rir);
      intensityProgramSets++;
    }
  }
  for (const a of activitySessions) {
    if (new Date(a.startedAt) >= fourteenDaysAgo && a.rpe != null) {
      const pseudoRir = Math.max(0, 10 - a.rpe);
      recentRirs.push(pseudoRir);
      intensityActivitySessions++;
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
  for (const a of activitySessions) {
    if (new Date(a.startedAt) >= fourteenDaysAgo) {
      recentSessionDays.add(new Date(a.startedAt).toISOString().slice(0, 10));
    }
  }

  // PRs: exercises where recent max 1RM exceeds historical max
  const historicalOrm: Record<string, number> = {};
  const recentOrm: Record<string, number> = {};
  for (const s of sets) {
    const orm = estimateOneRepMax(s);
    if (orm == null) continue;
    const name = s.exercise.name;
    if (new Date(s.completedAt) >= fourteenDaysAgo) {
      recentOrm[name] = Math.max(recentOrm[name] ?? 0, orm);
    } else {
      historicalOrm[name] = Math.max(historicalOrm[name] ?? 0, orm);
    }
  }
  let prs = 0;
  const prExercises: { name: string; recentOrm: number; previousBest: number }[] = [];
  for (const [name, val] of Object.entries(recentOrm)) {
    const prior = historicalOrm[name] ?? 0;
    if (val > prior * 1.005) {
      prs++;
      prExercises.push({ name, recentOrm: Math.round(val), previousBest: Math.round(prior) });
    }
  }
  prExercises.sort((a, b) => (b.recentOrm - b.previousBest) - (a.recentOrm - a.previousBest));

  const recentActivity = {
    sessionsLast14: recentSessionDays.size,
    setsLast14: recentSets.length,
    prsLast14: prs,
    sessionDates: [...recentSessionDays].sort((a, b) => b.localeCompare(a)),
    prExercises,
  };

  // Insights — reuse the same 4-week / prior-4-week windows as the strength trend
  // so a "Best momentum" exercise with weekly cadence isn't excluded for missing
  // a window, and the dashboard's narratives stay consistent.
  const momentumItems: { name: string; improvement: number }[] = [];
  const stallingItems: { name: string; weeks: number }[] = [];
  const deloadItems: { name: string; streak: number }[] = [];

  for (const name of exercisesByVolume) {
    const last4vals = recent4.map(w => weeklyExOrm[w]?.[name]).filter((v): v is number => v != null);
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

  const volumeChangePct =
    prevVol > 0 ? (currVol - prevVol) / prevVol : null;

  const scoreBreakdown: DashboardData["scoreBreakdown"] = {
    consistency: {
      sessions: consistencySessions,
      windowDays: 28,
      targetSessions: 16,
      sessionDates: [...sessionDays].sort((a, b) => b.localeCompare(a)),
    },
    volumeTrend: {
      currentTwoWeekVolume: Math.round(currVol),
      previousTwoWeekVolume: Math.round(prevVol),
      changePct: volumeChangePct,
    },
    strengthTrend: {
      avgChangePct: strengthDeltas.length ? avgDelta : null,
      perExercise: strengthPerExercise,
    },
    intensity: {
      avgRir,
      sampleSize: recentRirs.length,
      programSets: intensityProgramSets,
      activitySessions: intensityActivitySessions,
    },
  };

  return {
    hasData: true,
    healthScore,
    scoreBreakdown,
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
