"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/repositories/dashboard";
import { TrendingUp, TrendingDown, Minus, Zap, Activity, Dumbbell, Trophy, AlertTriangle, Battery } from "lucide-react";
import { ScoreDetailDialog, type ScoreDetailKind } from "./score-detail-dialog";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function scoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.75) return "text-green-400";
  if (pct >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.75) return "bg-green-400/20 border-green-400/30";
  if (pct >= 0.5) return "bg-yellow-400/20 border-yellow-400/30";
  return "bg-red-400/20 border-red-400/30";
}

function totalScoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Needs work";
}

function totalScoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 65) return "text-yellow-400";
  if (score >= 45) return "text-orange-400";
  return "text-red-400";
}

function formatWeek(key: string) {
  // "2026-W12" → "W12"
  return key.split("-")[1] ?? key;
}

function TrendIcon({ label }: { label: string }) {
  if (label.toLowerCase().includes("improv")) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (label.toLowerCase().includes("declin") || label.toLowerCase().includes("dip")) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DashboardClient({ data }: { data: DashboardData }) {
  if (!data.hasData) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Dumbbell className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No logged sets yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Log some workouts and your dashboard will show strength trends, volume charts, and exercise insights.
            </p>
            <Button asChild className="mt-2">
              <Link href="/programs">Go to Programs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { healthScore, recentActivity, weeklyVolume, exerciseOneRM, insights } = data;
  const [detail, setDetail] = useState<ScoreDetailKind | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Health score + recent activity */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Big health score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => setDetail({ kind: "overall" })}
              className="flex items-end gap-3 mb-4 -mx-1 px-1 py-1 rounded-md hover:bg-muted/40 transition-colors text-left w-full"
            >
              <span className={`text-5xl font-bold tabular-nums ${totalScoreColor(healthScore.total)}`}>
                {healthScore.total}
              </span>
              <span className="text-muted-foreground text-sm mb-1">/ 100 · {totalScoreLabel(healthScore.total)}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <ScorePill label="Consistency" score={healthScore.consistency} max={25} sub={healthScore.consistencyLabel} icon={<Zap className="h-3 w-3" />} onClick={() => setDetail({ kind: "consistency" })} />
              <ScorePill label="Volume" score={healthScore.volumeTrend} max={25} sub={healthScore.volumeLabel} icon={<TrendIcon label={healthScore.volumeLabel} />} onClick={() => setDetail({ kind: "volume" })} />
              <ScorePill label="Strength" score={healthScore.strengthTrend} max={25} sub={healthScore.strengthLabel} icon={<TrendIcon label={healthScore.strengthLabel} />} onClick={() => setDetail({ kind: "strength" })} />
              <ScorePill label="Intensity" score={healthScore.intensity} max={25} sub={healthScore.intensityLabel} icon={<Battery className="h-3 w-3" />} onClick={() => setDetail({ kind: "intensity" })} />
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <StatRow label="Sessions" value={recentActivity.sessionsLast14} icon={<Dumbbell className="h-4 w-4 text-indigo-400" />} onClick={() => setDetail({ kind: "sessions" })} />
            <StatRow label="Working sets" value={recentActivity.setsLast14} icon={<Activity className="h-4 w-4 text-green-400" />} onClick={() => setDetail({ kind: "sets" })} />
            <StatRow label="Est. PRs hit" value={recentActivity.prsLast14} icon={<Trophy className="h-4 w-4 text-yellow-400" />} onClick={() => setDetail({ kind: "prs" })} />
          </CardContent>
        </Card>
      </div>

      {/* Weekly volume chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Volume (lb)</CardTitle>
          <p className="text-xs text-muted-foreground">Total working load (weight × reps) across all exercises, last 12 weeks</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyVolume} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={40} />
              <Tooltip
                contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString()} lb`, "Volume"]}
                labelFormatter={formatWeek}
              />
              <Area type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2} fill="url(#volGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Estimated 1RM chart */}
      {exerciseOneRM.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Est. 1RM by Exercise</CardTitle>
            <p className="text-xs text-muted-foreground">Epley formula · top 5 exercises by volume · last 12 weeks</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="week"
                  type="category"
                  allowDuplicatedCategory={false}
                  tickFormatter={formatWeek}
                  tick={{ fontSize: 11, fill: "#888" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} width={40} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`${v} lb`, name]}
                  labelFormatter={formatWeek}
                />
                {exerciseOneRM.map((ex, i) => (
                  <Line
                    key={ex.name}
                    data={ex.data.filter(d => d.orm != null).map(d => ({ week: d.week, orm: d.orm }))}
                    dataKey="orm"
                    name={ex.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {exerciseOneRM.map((ex, i) => (
                <Link
                  key={ex.name}
                  href={`/history/name/${encodeURIComponent(ex.name)}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {ex.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full insights */}
      {(insights.topMomentum.length > 0 || insights.stalling.length > 0 || insights.deloadDue.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {insights.topMomentum.length > 0 && (
            <InsightCard
              title="Best momentum"
              icon={<TrendingUp className="h-4 w-4 text-green-400" />}
              color="border-green-400/20"
            >
              {insights.topMomentum.map(e => (
                <InsightRow key={e.name} name={e.name} badge={`+${(e.improvement * 100).toFixed(0)}%`} badgeColor="text-green-400" />
              ))}
            </InsightCard>
          )}
          {insights.stalling.length > 0 && (
            <InsightCard
              title="Stalling"
              icon={<AlertTriangle className="h-4 w-4 text-yellow-400" />}
              color="border-yellow-400/20"
            >
              {insights.stalling.map(e => (
                <InsightRow key={e.name} name={e.name} badge={`${e.weeks}w flat`} badgeColor="text-yellow-400" />
              ))}
            </InsightCard>
          )}
          {insights.deloadDue.length > 0 && (
            <InsightCard
              title="Deload due"
              icon={<Battery className="h-4 w-4 text-orange-400" />}
              color="border-orange-400/20"
            >
              {insights.deloadDue.map(e => (
                <InsightRow key={e.name} name={e.name} badge={`${e.streak}w streak`} badgeColor="text-orange-400" />
              ))}
            </InsightCard>
          )}
        </div>
      )}

      <ScoreDetailDialog
        open={detail !== null}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        detail={detail}
        data={data}
      />
    </div>
  );
}

function ScorePill({ label, score, max, sub, icon, onClick }: { label: string; score: number; max: number; sub: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition-colors hover:brightness-125 ${scoreBg(score, max)}`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${scoreColor(score, max)}`}>{score}<span className="text-xs font-normal text-muted-foreground">/{max}</span></span>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{sub}</span>
      </div>
    </button>
  );
}

function StatRow({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-2 -mx-2 hover:bg-muted/40 transition-colors text-left"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </button>
  );
}

function InsightCard({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <Card className={`border ${color}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function InsightRow({ name, badge, badgeColor }: { name: string; badge: string; badgeColor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <Link
        href={`/history/name/${encodeURIComponent(name)}`}
        className="text-muted-foreground hover:text-foreground truncate"
      >
        {name}
      </Link>
      <span className={`shrink-0 text-xs font-medium ${badgeColor}`}>{badge}</span>
    </div>
  );
}
