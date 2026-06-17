export function pickPrefillValue(
  existing: number | null | undefined,
  previous: number | null | undefined,
  template: number | null | undefined
): number | undefined {
  if (existing != null) return existing;
  if (previous != null) return previous;
  if (template != null) return template;
  return undefined;
}
