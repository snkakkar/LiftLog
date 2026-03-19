/**
 * Shared API helpers: auth error responses, etc.
 * Preserves exact status codes and response shapes for route contracts.
 */

import { NextResponse } from "next/server";

/**
 * Returns a 401 JSON response for requireUserId auth errors, or null if not an auth error.
 * Use in routes that call requireUserId() and need to return 401 for Unauthorized.
 */
export function requireUserIdErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof Error && e.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Returns a 403 JSON response for requireAdmin auth errors, or null if not an auth error.
 * Use in routes that call requireAdmin() and need to return 403 for Unauthorized/Forbidden.
 */
export function requireAdminErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden: admin only")) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
  return null;
}
