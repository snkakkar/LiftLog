# LiftLog Refactor Audit & Summary

## Executive Summary

The codebase is generally well-structured. The import pipeline is modular and justified. Auth patterns are consistent. Main opportunities: consolidate duplicated user creation, centralize auth error handling, extract program data access, and remove migration-era residue.

---

## REFACTOR COMPLETED

### What Was Simplified

1. **User creation** — Extracted to `lib/services/user.ts` (`createUser`, `validateEmail`, `validatePassword`). Signup and admin user creation now share the same logic.
2. **Auth error handling** — Extracted to `lib/http/api.ts` (`requireUserIdErrorResponse`, `requireAdminErrorResponse`). Change-password and admin routes use these helpers.
3. **Program data access** — Extracted to `lib/repositories/programs.ts` (`getProgramsForUser`, `getProgramById`). Home page, program page, and programs API use these.
4. **Exercise history** — Extracted to `lib/repositories/exercises.ts` (`getExerciseNamesWithHistory`). History page uses this.
5. **Admin page guard** — Added `ensureAdminPage()` in `lib/auth.ts`. Admin page uses it instead of inline session checks.
6. **Debug endpoint** — Removed migration-era `migratedUser` / `migratedUserExists` from `/api/debug-db`. Response now returns `{ ok, userCount }` only.

### Files Changed

| File | Change |
|------|--------|
| `lib/services/user.ts` | **NEW** — User creation and validation |
| `lib/http/api.ts` | **NEW** — Auth error response helpers |
| `lib/repositories/programs.ts` | **NEW** — Program fetch helpers |
| `lib/repositories/exercises.ts` | **NEW** — Exercise history helper |
| `lib/auth.ts` | Added `ensureAdminPage()` |
| `app/api/auth/signup/route.ts` | Uses `createUser` |
| `app/api/admin/users/route.ts` | Uses `createUser`, `requireAdminErrorResponse` |
| `app/api/auth/change-password/route.ts` | Uses `requireUserIdErrorResponse` |
| `app/api/admin/stats/route.ts` | Uses `requireAdminErrorResponse` |
| `app/api/programs/route.ts` | Uses `getProgramsForUser` |
| `app/api/programs/[id]/route.ts` | Uses `getProgramById` |
| `app/api/debug-db/route.ts` | Removed migratedUser fields |
| `app/page.tsx` | Uses `getProgramsForUser` |
| `app/program/[id]/page.tsx` | Uses `getProgramById` |
| `app/history/page.tsx` | Uses `getExerciseNamesWithHistory` |
| `app/admin/page.tsx` | Uses `ensureAdminPage` |

### Functionality Unchanged

- Multi-user support, auth, authorization, admin, per-user data isolation — all preserved
- API route contracts, response shapes, redirects, auth rules — unchanged (except debug-db simplified)
- Import pipeline — untouched; remains modular
- Database schema — untouched
- Environment variables — untouched

### Risks / Remaining Technical Debt

- **debug-db**: Response shape changed (removed `migratedUserExists`, `migratedUser`). No internal consumers found.
- **eslint-config-next**: 15.0.7 vs next 16.2.0 — version drift; no runtime impact.
- **proxy.ts**: Correct for Next.js 16; no change needed.

---

## 1. Duplicated Business Logic

### User creation (HIGH)
- **Locations**: `app/api/auth/signup/route.ts`, `app/api/admin/users/route.ts`
- **Duplication**: Email validation regex, password length check, `findUnique` for existing user, `hash(password, 12)`, `user.create` with same shape
- **Action**: Extract to `lib/services/user.ts` → `createUser({ email, password, name })`

### Auth error handling (MEDIUM)
- **Locations**: `app/api/auth/change-password/route.ts` (401 for Unauthorized), `app/api/admin/users/route.ts`, `app/api/admin/stats/route.ts` (403 for Unauthorized/Forbidden)
- **Duplication**: try/catch with `e.message === "Unauthorized"` etc.
- **Action**: Extract to `lib/http/api.ts` → `requireUserIdErrorResponse(e)`, `requireAdminErrorResponse(e)` (preserve 401 vs 403 semantics)

---

## 2. Duplicated Validation

- Email: `!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)` in signup and admin/users
- Password: `password.length < 8` in signup, admin/users, change-password
- **Action**: Centralize in user service; change-password keeps its own validation (different flow)

---

## 3. Repeated Auth/Session Checks

- **API routes**: All use `requireUserId()` or `requireAdmin()` consistently ✓
- **Pages**: `getCurrentUserId()` + redirect, or `getServerSession` + redirect (admin)
- **Admin page**: Manual `getServerSession` + redirect instead of shared helper
- **Action**: Add `requireAdminOrRedirect()` for pages if desired; low priority since only one page

---

## 4. Direct Prisma Usage

| Location | Usage |
|----------|--------|
| `app/page.tsx` | `prisma.program.findMany` + filter archived |
| `app/program/[id]/page.tsx` | Local `getProgram(id, userId)` |
| `app/history/page.tsx` | `getExerciseNamesWithHistory(userId)` |
| `app/api/*` | All routes use prisma directly |
| `lib/import/to-db.ts` | prisma for import |

- **Action**: Extract `lib/repositories/programs.ts` with `getProgramsForUser`, `getProgramById` for reuse. Pages and API can call these. Keeps Prisma access centralized without over-abstracting.

---

## 5. Migration/Debug Residue

- **`app/api/debug-db/route.ts`**: References `migrated@liftlog.local`, `migratedUserExists` — migration-era
- **Action**: Simplify to generic DB check (userCount only). Preserve route contract (ok, userCount) for any existing consumers. Remove migratedUser fields.

---

## 6. Stale/Contradictory Documentation

- **`app/profile/page.tsx`**: Comment says "Profile has moved to the account menu" — accurate
- **Prisma schema**: Comments "optional during migration" — legacy; schema is current
- **debug-db**: "Remove or protect this in production" — accurate

---

## 7. Tooling/Version Inconsistencies

- `eslint-config-next: 15.0.7` vs `next: 16.2.0` — minor drift
- **Action**: Align eslint-config-next to 16.x if available; otherwise leave (no runtime impact)

---

## 8. What Is Well-Designed (Leave As-Is)

- **Import pipeline**: Modular (pipeline, to-db, validateImport, classifyRows, parseTable, etc.). Do not collapse.
- **Auth**: `getCurrentUserId`, `requireUserId`, `requireAdmin` are clear and consistent
- **account vs profile**: Separate concerns (User name/email vs Profile height/age/gender) — correct
- **proxy.ts**: Next.js 16 uses `proxy.ts` for middleware — correct

---

## Refactor Plan (Step-by-Step)

1. Create `lib/services/user.ts` — `createUser`, `validateEmail`, `validatePassword`
2. Create `lib/http/api.ts` — `requireUserIdErrorResponse`, `requireAdminErrorResponse`
3. Create `lib/repositories/programs.ts` — `getProgramsForUser`, `getProgramById`
4. Refactor signup and admin/users to use user service
5. Refactor change-password, admin/users, admin/stats to use auth error helpers
6. Refactor app/page.tsx and app/program/[id]/page.tsx to use program repository (optional, if it simplifies)
7. Simplify debug-db (remove migratedUser)
8. Update comments/docs
