/**
 * Time helpers shared across server code.
 *
 * Kept deliberately small — only utilities that are duplicated or have
 * non-obvious semantics (e.g. local-day vs UTC-day) live here. Inline
 * `new Date().toISOString()` style formatting is fine in callers.
 */

/**
 * Start (inclusive) and end (exclusive) of "today" in the server's local time zone.
 * Use for filtering rows by calendar day. Both bounds are at midnight local.
 */
export function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}
