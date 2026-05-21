"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Activity, Battery, Dumbbell, Trophy, TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { DashboardData } from "@/lib/repositories/dashboard";

export type ScoreDetailKind =
  | { kind: "overall" }
  | { kind: "consistency" }
  | { kind: "volume" }
  | { kind: "strength" }
  | { kind: "intensity" }
  | { kind: "sessions" }
  | { kind: "sets" }
  | { kind: "prs" };

export function ScoreDetailDialog({
  open,
  onOpenChange,
  detail,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ScoreDetailKind | null;
  data: DashboardData;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {detail && <DetailBody detail={detail} data={data} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ detail, data }: { detail: ScoreDetailKind; data: DashboardData }) {
  switch (detail.kind) {
    case "overall":
      return <OverallBody data={data} />;
    case "consistency":
      return <ConsistencyBody data={data} />;
    case "volume":
      return <VolumeBody data={data} />;
    case "strength":
      return <StrengthBody data={data} />;
    case "intensity":
      return <IntensityBody data={data} />;
    case "sessions":
      return <SessionsBody data={data} />;
    case "sets":
      return <SetsBody data={data} />;
    case "prs":
      return <PrsBody data={data} />;
  }
}

function OverallBody({ data }: { data: DashboardData }) {
  const { healthScore } = data;
  const parts = [
    { label: "Consistency", value: healthScore.consistency, max: 25, hint: healthScore.consistencyLabel, color: "text-indigo-400" },
    { label: "Volume",      value: healthScore.volumeTrend, max: 25, hint: healthScore.volumeLabel,      color: "text-emerald-400" },
    { label: "Strength",    value: healthScore.strengthTrend, max: 25, hint: healthScore.strengthLabel,  color: "text-amber-400" },
    { label: "Intensity",   value: healthScore.intensity, max: 25, hint: healthScore.intensityLabel,     color: "text-pink-400" },
  ];
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Overall Score · {healthScore.total}/100
        </DialogTitle>
        <DialogDescription>
          Your training health, rolled up from four equally-weighted areas.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        {parts.map((p) => (
          <ScoreRow key={p.label} label={p.label} value={p.value} max={p.max} hint={p.hint} color={p.color} />
        ))}
      </div>
      <div className="rounded-lg bg-muted/40 px-4 py-3 mt-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Rating</p>
        <ul className="space-y-0.5 text-xs">
          <li><span className="text-green-400">80–100</span> · Excellent</li>
          <li><span className="text-yellow-400">65–79</span> · Good</li>
          <li><span className="text-orange-400">45–64</span> · Fair</li>
          <li><span className="text-red-400">0–44</span> · Needs work</li>
        </ul>
      </div>
    </>
  );
}

function ConsistencyBody({ data }: { data: DashboardData }) {
  const { healthScore, scoreBreakdown } = data;
  const c = scoreBreakdown.consistency;
  const ratio = Math.min(1, c.sessions / c.targetSessions);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-400" />
          Consistency · {healthScore.consistency}/25
        </DialogTitle>
        <DialogDescription>
          How regularly you&apos;ve been training over the last {c.windowDays} days.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <BigStat
          value={c.sessions}
          unit={c.sessions === 1 ? "session" : "sessions"}
          caption={`in the last ${c.windowDays} days`}
        />
        <ProgressBar value={ratio} colorClass="bg-indigo-400" />
        <p className="text-sm text-muted-foreground">
          Hitting <span className="font-medium text-foreground">{c.targetSessions} sessions</span> in
          this window earns the full 25 points. Both program workouts and standalone activity
          sessions count.
        </p>
        {c.sessionDates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent training days</p>
            <div className="flex flex-wrap gap-1.5">
              {c.sessionDates.slice(0, 14).map((d) => (
                <span
                  key={d}
                  className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-xs text-indigo-300"
                >
                  {formatShortDate(d)}
                </span>
              ))}
              {c.sessionDates.length > 14 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{c.sessionDates.length - 14} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function VolumeBody({ data }: { data: DashboardData }) {
  const { healthScore, scoreBreakdown } = data;
  const v = scoreBreakdown.volumeTrend;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <TrendIconLarge label={healthScore.volumeLabel} />
          Volume · {healthScore.volumeTrend}/25
        </DialogTitle>
        <DialogDescription>
          Whether your total work (weight × reps) is growing, holding, or dropping.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Trend</p>
          <p className="text-2xl font-bold">{healthScore.volumeLabel}</p>
          {v.changePct != null && (
            <p className={`text-sm mt-1 ${v.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {v.changePct >= 0 ? "+" : ""}{(v.changePct * 100).toFixed(1)}% vs the prior 2 weeks
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PeriodCard label="Last 2 weeks" value={`${v.currentTwoWeekVolume.toLocaleString()} lb`} />
          <PeriodCard label="Prior 2 weeks" value={`${v.previousTwoWeekVolume.toLocaleString()} lb`} />
        </div>
        <p className="text-sm text-muted-foreground">
          Volume rising at least 10% scores the full 25. Holding steady (within ±10%) scores 18.
          Drops earn fewer points so you notice when you back off.
        </p>
      </div>
    </>
  );
}

function StrengthBody({ data }: { data: DashboardData }) {
  const { healthScore, scoreBreakdown } = data;
  const s = scoreBreakdown.strengthTrend;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <TrendIconLarge label={healthScore.strengthLabel} />
          Strength · {healthScore.strengthTrend}/25
        </DialogTitle>
        <DialogDescription>
          Movement in your estimated 1-rep max on your top exercises.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Trend</p>
          <p className="text-2xl font-bold">{healthScore.strengthLabel}</p>
          {s.avgChangePct != null && (
            <p className={`text-sm mt-1 ${s.avgChangePct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {s.avgChangePct >= 0 ? "+" : ""}{(s.avgChangePct * 100).toFixed(1)}% average across top lifts
            </p>
          )}
        </div>
        {s.perExercise.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Top lifts</p>
            <div className="space-y-1.5">
              {s.perExercise.map((ex) => (
                <ExerciseDeltaRow
                  key={ex.name}
                  name={ex.name}
                  recent={ex.recentBest}
                  previous={ex.previousBest}
                  changePct={ex.changePct}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            We need at least 4 weeks of logged sets on a top lift to read the trend. Keep logging.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Comparing the last 2 weeks against the 2 weeks before. Up 3% or more across your top
          lifts scores the full 25.
        </p>
      </div>
    </>
  );
}

function IntensityBody({ data }: { data: DashboardData }) {
  const { healthScore, scoreBreakdown } = data;
  const i = scoreBreakdown.intensity;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Battery className="h-5 w-5 text-pink-400" />
          Intensity · {healthScore.intensity}/25
        </DialogTitle>
        <DialogDescription>
          How close to failure your recent sets have been.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        {i.avgRir != null ? (
          <BigStat
            value={i.avgRir.toFixed(1)}
            unit="avg RIR"
            caption={describeRir(i.avgRir)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No reps-in-reserve (RIR) or RPE data in the last 14 days. Log RIR on your sets to see
            this score.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <PeriodCard label="Lifting sets logged" value={String(i.programSets)} />
          <PeriodCard label="Activity sessions" value={String(i.activitySessions)} />
        </div>
        <p className="text-sm text-muted-foreground">
          RIR (reps left in the tank) is averaged across the last 14 days. Lower = harder. Activity
          sessions contribute their RPE, mapped to a comparable scale.
        </p>
      </div>
    </>
  );
}

function SessionsBody({ data }: { data: DashboardData }) {
  const sessions = data.recentActivity.sessionDates;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-indigo-400" />
          Sessions · last 14 days
        </DialogTitle>
        <DialogDescription>
          Days you trained — counted once per day even if you logged multiple workouts.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        <BigStat value={sessions.length} unit={sessions.length === 1 ? "training day" : "training days"} caption="in the last 14 days" />
        {sessions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sessions.map((d) => (
              <span
                key={d}
                className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-xs text-indigo-300"
              >
                {formatShortDate(d)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sessions yet in this window.</p>
        )}
      </div>
    </>
  );
}

function SetsBody({ data }: { data: DashboardData }) {
  const count = data.recentActivity.setsLast14;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          Working sets · last 14 days
        </DialogTitle>
        <DialogDescription>
          Real working sets — warm-ups and form-deload sets aren&apos;t counted.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        <BigStat value={count} unit={count === 1 ? "set" : "sets"} caption="logged in the last 14 days" />
        <p className="text-sm text-muted-foreground">
          Only sets with both reps and weight recorded count. Warm-ups and intentional form-cleanup
          sets are filtered out so the number reflects actual training stimulus.
        </p>
      </div>
    </>
  );
}

function PrsBody({ data }: { data: DashboardData }) {
  const prs = data.recentActivity.prExercises;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          Estimated PRs · last 14 days
        </DialogTitle>
        <DialogDescription>
          Lifts where your recent estimated 1-rep max beat your previous best.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        <BigStat value={prs.length} unit={prs.length === 1 ? "PR" : "PRs"} caption="hit recently" />
        {prs.length > 0 ? (
          <div className="space-y-2">
            {prs.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2"
              >
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-yellow-400 font-medium">{p.recentOrm} lb</span>
                  {p.previousBest > 0 && <> · up from {p.previousBest} lb</>}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No estimated PRs in the last 14 days yet — keep going.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Estimated 1RM is calculated from your reps, weight, and reps-in-reserve using the Epley
          formula.
        </p>
      </div>
    </>
  );
}

function ScoreRow({ label, value, max, hint, color }: { label: string; value: number; max: number; hint: string; color: string }) {
  const pct = value / max;
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${color}`}>
          {value}<span className="text-xs font-normal text-muted-foreground">/{max}</span>
        </span>
      </div>
      <ProgressBar value={pct} colorClass={color.replace("text-", "bg-")} />
      <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
    </div>
  );
}

function ProgressBar({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function BigStat({ value, unit, caption }: { value: number | string; unit: string; caption: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums">{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{caption}</p>
    </div>
  );
}

function PeriodCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function ExerciseDeltaRow({ name, recent, previous, changePct }: { name: string; recent: number; previous: number; changePct: number }) {
  const positive = changePct >= 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
      <span className="text-sm truncate">{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {previous} → {recent} lb
        </span>
        <span className={`text-xs font-medium ${positive ? "text-green-400" : "text-red-400"} tabular-nums`}>
          {positive ? "+" : ""}{(changePct * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function TrendIconLarge({ label }: { label: string }) {
  const l = label.toLowerCase();
  if (l.includes("improv")) return <TrendingUp className="h-5 w-5 text-green-400" />;
  if (l.includes("declin") || l.includes("dip")) return <TrendingDown className="h-5 w-5 text-red-400" />;
  return <Activity className="h-5 w-5 text-muted-foreground" />;
}

function describeRir(rir: number): string {
  if (rir <= 1) return "Very high — close to failure on most sets";
  if (rir <= 2) return "High — leaving 1–2 reps in the tank";
  if (rir <= 3) return "Moderate — solid working effort";
  return "Low — most sets feel comfortable";
}

function formatShortDate(iso: string): string {
  // ISO date like "2026-05-19" → "May 19"
  const [, m, d] = iso.split("-").map(Number) as [number, number, number];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}
