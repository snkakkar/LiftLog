"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Activity, Footprints, Zap, Dumbbell, Heart, MoreHorizontal } from "lucide-react";

type Activity = {
  id: string;
  kind: string;
  name: string;
  startedAt: string;
  durationMin: number | null;
  distanceMi: number | null;
  caloriesBurned: number | null;
  rpe: number | null;
  note: string | null;
};

/** YYYY-MM-DD in local time, suitable for a date input default. */
function todayLocalISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a YYYY-MM-DD date input into an ISO timestamp at local noon, so the date the user picked is preserved across timezones. */
function dateInputToISO(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

const KINDS: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "cardio", label: "Cardio", icon: Heart },
  { value: "hiit", label: "HIIT", icon: Zap },
  { value: "walk", label: "Walk", icon: Footprints },
  { value: "strength", label: "Strength (off-program)", icon: Dumbbell },
  { value: "mobility", label: "Mobility", icon: Activity },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function iconForKind(kind: string) {
  const k = KINDS.find((x) => x.value === kind);
  return k?.icon ?? MoreHorizontal;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LogActivityClient({ recent }: { recent: Activity[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("cardio");
  const [name, setName] = useState("");
  const [date, setDate] = useState<string>(todayLocalISO());
  const [durationMin, setDurationMin] = useState("");
  const [distanceMi, setDistanceMi] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [rpe, setRpe] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/activity-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          startedAt: dateInputToISO(date),
          durationMin: durationMin ? Number(durationMin) : null,
          distanceMi: distanceMi ? Number(distanceMi) : null,
          caloriesBurned: caloriesBurned ? Number(caloriesBurned) : null,
          rpe: rpe ? Number(rpe) : null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Failed to save");
        return;
      }
      setName("");
      setDate(todayLocalISO());
      setDurationMin("");
      setDistanceMi("");
      setCaloriesBurned("");
      setRpe("");
      setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/activity-sessions/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Type</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {KINDS.map((k) => {
                  const Icon = k.icon;
                  const active = kind === k.value;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <div>
                <Label className="text-xs" htmlFor="activity-name">Name</Label>
                <Input
                  id="activity-name"
                  placeholder='e.g. "Hotel HIIT" or "Sunday long walk"'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="activity-date">Date</Label>
                <Input
                  id="activity-date"
                  type="date"
                  max={todayLocalISO()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs" htmlFor="activity-duration">Duration (min)</Label>
                <Input
                  id="activity-duration"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="activity-distance">Distance (mi)</Label>
                <Input
                  id="activity-distance"
                  type="number"
                  min={0}
                  step={0.1}
                  inputMode="decimal"
                  value={distanceMi}
                  onChange={(e) => setDistanceMi(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="activity-calories">Calories</Label>
                <Input
                  id="activity-calories"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="activity-rpe">RPE (1–10)</Label>
                <Input
                  id="activity-rpe"
                  type="number"
                  min={1}
                  max={10}
                  inputMode="numeric"
                  placeholder="effort"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs" htmlFor="activity-note">Note (optional)</Label>
              <Input
                id="activity-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Log activity
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activities</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No activities logged yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => {
                const Icon = iconForKind(a.kind);
                return (
                  <li key={a.id} className="py-2 flex items-start gap-3">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.startedAt)}
                        {a.durationMin != null ? ` · ${a.durationMin} min` : ""}
                        {a.distanceMi != null ? ` · ${a.distanceMi} mi` : ""}
                        {a.caloriesBurned != null ? ` · ${a.caloriesBurned} cal` : ""}
                        {a.rpe != null ? ` · RPE ${a.rpe}` : ""}
                      </p>
                      {a.note && <p className="text-xs text-muted-foreground mt-0.5">{a.note}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => void handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      aria-label="Delete activity"
                    >
                      {deletingId === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
