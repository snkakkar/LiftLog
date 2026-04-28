"use client";

import { useEffect, useState } from "react";

export function DeloadToggle({ workoutDayId }: { workoutDayId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDeload, setIsDeload] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/by-day?workoutDayId=${encodeURIComponent(workoutDayId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (s?.id) {
          setSessionId(s.id);
          if (s.isDeload) setIsDeload(true);
        }
      })
      .catch(() => {});
  }, [workoutDayId]);

  const handleToggle = async (value: boolean) => {
    setIsDeload(value);
    let sid = sessionId;
    if (!sid) {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutDayId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      sid = data.id;
      setSessionId(sid);
    }
    await fetch(`/api/sessions/${sid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeload: value }),
    });
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          role="switch"
          aria-checked={isDeload}
          onClick={() => void handleToggle(!isDeload)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDeload ? "bg-amber-400" : "bg-input"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isDeload ? "translate-x-6" : "translate-x-1"}`} />
        </div>
        <span className={`text-sm font-medium ${isDeload ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          Deload
        </span>
      </label>
      {isDeload && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Excluded from history &amp; charts</p>
      )}
    </div>
  );
}
