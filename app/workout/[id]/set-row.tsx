"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Minus, Plus } from "lucide-react";
import { estimateOneRepMax } from "@/lib/strength/oneRepMax";

/**
 * One row of the workout-log form: reps / weight / RIR inputs, warm-up and
 * form-set checkboxes, and the Log button. Drives a single
 * `onLog(reps, weight, rir, isWarmup, isFormDeload)` callback.
 */
export function SetRow({
  setNumber,
  hideSetNumber,
  targetReps,
  targetWeight,
  targetRir,
  initialReps,
  initialWeight,
  initialRir,
  initialIsFormDeload,
  isBodyweight,
  bodyWeightLb,
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
  initialIsFormDeload?: boolean | null;
  isBodyweight?: boolean;
  bodyWeightLb?: number;
  onLog: (
    reps?: number,
    weight?: number,
    rir?: number,
    isWarmup?: boolean,
    isFormDeload?: boolean
  ) => void | Promise<void>;
}) {
  const [reps, setReps] = useState(initialReps ?? undefined);
  const [weight, setWeight] = useState(initialWeight ?? undefined);
  const [rir, setRir] = useState(initialRir ?? undefined);
  const [isWarmup, setIsWarmup] = useState(false);
  const [isFormDeload, setIsFormDeload] = useState(initialIsFormDeload === true);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [repsEntered, setRepsEntered] = useState(initialReps != null && initialReps > 0);

  useEffect(() => {
    setReps(initialReps ?? undefined);
    setWeight(initialWeight ?? undefined);
    setRir(initialRir ?? undefined);
    setIsFormDeload(initialIsFormDeload === true);
    setRepsEntered(initialReps != null && initialReps > 0);
  }, [initialReps, initialWeight, initialRir, initialIsFormDeload]);

  const handleSave = async () => {
    setSaving(true);
    setSavedJustNow(false);
    try {
      await Promise.resolve(onLog(reps, weight, rir, isWarmup, isFormDeload));
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const inc = (v: number | undefined, step: number, min = 0) =>
    v != null ? Math.max(min, v + step) : min + step;
  const dec = (v: number | undefined, step: number, min = 0) =>
    v != null ? Math.max(min, v - step) : min;

  const oneRm = estimateOneRepMax({ weight, reps, rir, isFormDeload });

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
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              setReps(val);
              if (val != null && val > 0) setRepsEntered(true);
            }}
            className="h-9 flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 hidden md:flex"
            onClick={() => {
              setReps((r) => inc(r, 1));
              setRepsEntered(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-w-[80px]">
        <Label className="text-xs">
          {isBodyweight
            ? bodyWeightLb != null
              ? `Added weight (BW: ${bodyWeightLb} lb)`
              : "Added weight (lb)"
            : "Weight (lb)"}
        </Label>
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
      {oneRm != null && (
        <div className="shrink-0 self-end pb-2">
          <span className="text-xs text-muted-foreground">est. 1RM: {oneRm} lb</span>
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
      <label
        className="flex items-center gap-1.5 shrink-0 cursor-pointer"
        title="Mark this set when you intentionally lowered the weight to clean up form. It won't count against your strength trend or volume."
      >
        <input
          type="checkbox"
          checked={isFormDeload}
          onChange={(e) => setIsFormDeload(e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-xs text-muted-foreground">Form set</span>
      </label>
      <Button
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving || !repsEntered}
        variant={savedJustNow ? "secondary" : "default"}
        className={
          savedJustNow
            ? "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
            : ""
        }
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
