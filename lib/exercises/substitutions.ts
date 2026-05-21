/**
 * A free-form substitution column on an Exercise should be a short alternate
 * exercise name (e.g. "DB Bench Press"). Earlier imports pulled adjacent
 * "See Notes" / coaching-instruction text into this column too. This rule keeps
 * substitution-shaped strings and discards instruction-shaped ones.
 *
 * Returns the trimmed string when it looks like a real exercise name, or null
 * when the value is empty, a placeholder ("N/A"), or a sentence/instruction.
 */
export function cleanSubstitution(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;

  // Common placeholders authors put when no substitution exists
  const lower = t.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "none" || lower === "-") return null;

  // Sentence-ending punctuation in the middle or at the end → it's prose
  if (/[.!?](\s|$)/.test(t)) return null;

  // Common instruction prefixes/phrases
  if (/\b(see notes?|this can be|if you|note:|alt(?:ernative)?:)\b/i.test(t)) return null;

  // Real exercise names are short. ">6 words" or ">60 chars" are almost always prose.
  if (t.length > 60) return null;
  if (t.split(/\s+/).length > 6) return null;

  return t;
}
