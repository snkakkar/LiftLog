"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Confirmation banner asking the user whether to apply a structural change
 * to subsequent weeks of their program. Used by the workout log for rename,
 * reorder, add-exercise, superset-pair, and template-set edits.
 */
export function PropagateBanner({
  message,
  confirmLabel,
  busy,
  onConfirm,
  onDismiss,
}: {
  message: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-sm flex-1">{message}</p>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="default"
          className="h-8"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={busy}
          onClick={onDismiss}
        >
          No, just this week
        </Button>
      </div>
    </div>
  );
}
