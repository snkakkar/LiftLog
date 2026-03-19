/**
 * Value normalizer: extract and normalize cell values.
 * Handles Excel cells that look like ranges (1-2, 6-8, 8-10) but may be parsed as date-like.
 * Never treat those as real dates—use displayed/semantic values.
 */

export type CellValue = string | number | boolean | undefined | null;

/**
 * Get a stable text representation of a cell for labels (week, day, exercise name).
 * Excel may store "1-2" or "6-8" as a date serial; we return the numeric parts as text (e.g. "1-2").
 */
export function getText(val: CellValue): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val !== null && "richText" in val && Array.isArray((val as { richText: { text?: string }[] }).richText)) {
    return (val as { richText: { text?: string }[] })
      .richText.map((r) => r.text ?? "")
      .join("")
      .trim();
  }
  if (typeof val === "number") {
    if (Number.isNaN(val)) return "";
    if (val > 100000 || val < -1000) {
      const d = asExcelDate(val);
      if (d) return d;
    }
    return String(val);
  }
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return String(val).trim();
}

/**
 * If the number looks like an Excel date serial (e.g. 44927 for "6-8" interpreted as date),
 * try to recover a range-like string (month-day or day-month). Otherwise return null.
 */
function asExcelDate(n: number): string | null {
  if (n < 1 || n > 100000) return null;
  const floor = Math.floor(n);
  const dec = n - floor;
  if (dec > 0.001 && dec < 0.999) return null;
  const d = new Date((floor - 25569) * 86400 * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${month}-${day}`;
  }
  return null;
}

/**
 * Parse a cell to number. Handles string "135", "8", and numeric cells.
 * Returns undefined for empty, non-numeric, or NaN.
 */
export function toNum(val: CellValue): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Parse a range string like "1-2", "6-8", "8-10" (or Excel-mangled) into min/max.
 * Used for rep ranges and similar. Returns null if not a valid range.
 */
export function parseRange(text: string): { min: number; max: number } | null {
  const t = text.trim().replace(/\s+/g, "");
  const m = t.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const max = parseInt(m[2], 10);
  if (min > max) return { min: max, max: min };
  return { min, max };
}

/**
 * Safe integer for working set count, rep count, etc. Clamps to 0..99.
 */
export function toWorkingSetCount(val: CellValue): number {
  const n = toNum(val);
  if (n == null || n < 0) return 0;
  if (n > 99) return 99;
  return Math.floor(n);
}

/**
 * Safe weight (lb). Rejects negative and unreasonably large.
 */
export function toWeight(val: CellValue): number | undefined {
  const n = toNum(val);
  if (n == null || n < 0) return undefined;
  if (n > 10000) return undefined;
  return Math.round(n * 10) / 10;
}

/**
 * Safe rep count. 0..999.
 */
export function toReps(val: CellValue): number | undefined {
  const n = toNum(val);
  if (n == null || n < 0) return undefined;
  if (n > 999) return undefined;
  return Math.floor(n);
}

/**
 * RIR typically 0..10.
 */
export function toRir(val: CellValue): number | undefined {
  const n = toNum(val);
  if (n == null || n < 0 || n > 10) return undefined;
  return Math.floor(n);
}
