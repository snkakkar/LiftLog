"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

const SWIPE_THRESHOLD = 80;

export function SwipeToDeleteRow({
  children,
  onDelete,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentOffset = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    const dx = startX.current - e.touches[0].clientX;
    const next = Math.max(0, Math.min(dx, SWIPE_THRESHOLD * 1.5));
    currentOffset.current = next;
    setOffset(next);
  };

  const handleTouchEnd = () => {
    if (currentOffset.current >= SWIPE_THRESHOLD) {
      onDelete();
    }
    currentOffset.current = 0;
    setOffset(0);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Delete background - revealed when content swipes left on touch devices */}
      <div
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-destructive/90 text-destructive-foreground md:hidden"
        aria-hidden
      >
        <Trash2 className="h-4 w-4" />
      </div>
      <div
        className="relative bg-background touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: offset > 0 ? `translateX(-${offset}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
