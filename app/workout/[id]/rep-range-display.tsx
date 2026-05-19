"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { repRangeLabel } from "@/lib/exercises/format";

/**
 * Inline rep-range editor shown under an exercise title. Switches between a
 * read-only label ("Rep range: 8–12 reps") and an inline min/max edit form
 * controlled by the parent via `editingExId`.
 */
export function RepRangeDisplay({
  exerciseId,
  targetReps,
  targetRepsMin,
  editingExId,
  editingMin,
  editingMax,
  onStartEdit,
  onSave,
  onCancel,
  onChangeMin,
  onChangeMax,
}: {
  exerciseId: string;
  targetReps: number | null;
  targetRepsMin: number | null;
  editingExId: string | null;
  editingMin: string;
  editingMax: string;
  onStartEdit: (id: string, min: string, max: string) => void;
  onSave: (id: string, min: string, max: string) => Promise<void>;
  onCancel: () => void;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}) {
  const isEditing = editingExId === exerciseId;
  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground shrink-0">Rep range:</span>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          className="h-8 w-14 text-sm px-2"
          placeholder="min"
          value={editingMin}
          onChange={(e) => onChangeMin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave(exerciseId, editingMin, editingMax);
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          className="h-8 w-14 text-sm px-2"
          placeholder="max"
          value={editingMax}
          onChange={(e) => onChangeMax(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave(exerciseId, editingMin, editingMax);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={(e) => {
            if (!e.relatedTarget) void onSave(exerciseId, editingMin, editingMax);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-3 text-xs"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => void onSave(exerciseId, editingMin, editingMax)}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }
  const label = repRangeLabel(targetReps, targetRepsMin);
  return (
    <button
      type="button"
      className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group"
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit(
          exerciseId,
          targetRepsMin != null ? String(targetRepsMin) : "",
          targetReps != null ? String(targetReps) : ""
        );
      }}
    >
      {label ? (
        <>
          <span>Rep range: {label}</span>
          <span className="opacity-0 group-hover:opacity-60 text-[10px]">(edit)</span>
        </>
      ) : (
        <span className="opacity-50 group-hover:opacity-100">+ set rep target</span>
      )}
    </button>
  );
}
