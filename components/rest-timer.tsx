"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";

const DEFAULT_SECONDS = 90;

export function RestTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [targetSec, setTargetSec] = useState(DEFAULT_SECONDS);

  const start = useCallback(() => {
    setSecondsLeft(targetSec);
  }, [targetSec]);

  useEffect(() => {
    if (secondsLeft == null || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s == null ? null : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const display = secondsLeft != null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <Timer className="h-4 w-4 text-muted-foreground" />
      <input
        type="number"
        min={15}
        max={300}
        step={15}
        value={targetSec}
        onChange={(e) => setTargetSec(Math.max(15, Math.min(300, parseInt(e.target.value, 10) || 90)))}
        className="w-14 h-8 rounded border border-input bg-background px-2 text-sm"
      />
      <span className="text-xs text-muted-foreground">sec</span>
      {display != null ? (
        <span className="font-mono font-medium min-w-[3ch]">{display}</span>
      ) : (
        <Button size="sm" variant="secondary" onClick={start}>
          Start
        </Button>
      )}
    </div>
  );
}
