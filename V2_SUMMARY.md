# LiftLog V2 Upgrade Summary

## 1. Summary of V2 improvements

- **Import:** CSV support (in addition to .xlsx/.xls); accept attribute updated to `.xlsx,.xls,.csv`. V1 table and Min-Max parsers unchanged; pipeline and canonical IR preserved.
- **Workout UX:** Progression suggestions per exercise (from last logs + template); +/- quick adjust for reps and weight; warm-up checkbox per set; rest timer (configurable 15–300s) on workout page; autofill of weight from previous session when no template weight.
- **Program management:** Duplicate program (structure only, no logs); archive / unarchive; programs list excludes archived by default; archived section on home; PATCH program (name, archive); PATCH workout-day (day name); PATCH exercise (name, substitution1, substitution2).
- **History:** History nav item; `/history` lists exercises with logged sets; `/history/exercise/[id]` shows past sets by date with program context.
- **Session overrides:** Exercise override can include optional `note` (API only; UI can be wired later).
- **Schema:** `Program.archivedAt`, `LoggedSet.isWarmup`, `ExerciseOverride.note`.
- **Tests:** Vitest; tests for `parseSetsString` and `getProgressionSuggestion`.
- **README:** Updated for V2 features, scripts, and layout.

---

## 2. What was already present and preserved

- **Single-user, no auth:** Unchanged; no user accounts or multi-tenant logic.
- **Prisma schema:** Program → Week → WorkoutDay → Exercise (substitution1/2) → ExerciseSet (targetReps, targetWeight, targetRir); WorkoutSession → LoggedSet, ExerciseOverride. Preserved; only extended.
- **Import pipeline:** Canonical types (`ImportProgram`, `ImportWeek`, `ImportDay`, `ImportExercise`, `ImportSet` with rir, substitution1/2); `parse-sets.ts`; `parser-v1` (Week/Day/Exercise/Sets table); `parser-minmax` (Nippard-style with RIR, substitutions); `pipeline` (try V1 then Min-Max); `to-db`. No rewrites; pipeline and parsers left as-is.
- **Import preview:** Card-based preview with program name edit, weeks/days/exercises/sets summary, Save/Cancel. Preserved.
- **Parse API:** `raw: true`, first sheet, `parseWorkbookToProgram(rows)`. Preserved; added CSV handling by existing xlsx read.
- **Program page:** Back to programs, Rename, Delete; program title and week/day list with links to workout. Preserved.
- **Workout page:** Back to program; session get-or-create; load logged sets and overrides; previous performance; replace exercise (Original / Sub 1 / Sub 2 / Custom); SetRow with target/initial reps, weight, RIR; Log button. Preserved and extended (see below).
- **Navigation:** Back to program (workout), Back to programs (program). Preserved.
- **APIs:** GET/PATCH/DELETE programs, GET workout-day, GET/POST sessions, GET session by day, GET session sets, POST log, GET previous-log, GET/POST/DELETE overrides. All preserved and extended where needed.

---

## 3. What was newly added

- **Schema:** `Program.archivedAt`, `LoggedSet.isWarmup`, `ExerciseOverride.note`.
- **APIs:**  
  - `GET /api/programs?archived=1` (archived only).  
  - `PATCH /api/programs/[id]` body `{ archive: true | false }` for archive/unarchive.  
  - `POST /api/programs/[id]` to duplicate program (structure only).  
  - `PATCH /api/workout-day/[id]` body `{ name }` for day name.  
  - `PATCH /api/exercises/[id]` body `{ name?, substitution1?, substitution2? }`.  
  - `GET /api/exercises/[id]/recommendation` (progression suggestion).  
  - `GET /api/exercises/[id]/history` (logged sets for exercise).  
  - `GET /api/history/exercises` (exercise ids/names with history).
- **Lib:** `lib/progression/recommend.ts` (getProgressionSuggestion).
- **Components:** `components/rest-timer.tsx` (countdown with configurable seconds).
- **Pages:** `/history`, `/history/exercise/[id]` with `HistoryClient`.
- **UI:** Rest timer on workout page; progression suggestion when exercise expanded; +/- for reps/weight and warm-up checkbox in SetRow; Duplicate and Archive/Unarchive on program page; History in nav; archived section on home; `ProgramsList` component.
- **Tests:** `lib/import/__tests__/parse-sets.test.ts`, `lib/progression/__tests__/recommend.test.ts`.
- **Import:** CSV accepted in parse API and file input (`accept=".xlsx,.xls,.csv"`).

---

## 4. What was modified

- **app/api/programs/route.ts:** GET filters by `archivedAt: null` by default; `?archived=1` returns only archived.
- **app/api/programs/[id]/route.ts:** PATCH accepts `name` and `archive` (true/false); POST added for duplicate.
- **app/api/log/route.ts:** POST accepts `isWarmup` and persists it.
- **app/api/sessions/[id]/overrides/route.ts:** GET returns `note`; POST accepts optional `note`.
- **app/api/parse/route.ts:** Detects CSV by file extension and uses same xlsx read (with `raw: true` for CSV).
- **app/import/page.tsx:** File input `accept` includes `.csv`.
- **app/page.tsx:** Fetches active and archived programs; renders `ProgramsList` and archived section.
- **app/program/[id]/page.tsx:** Passes `isArchived` to `ProgramActions`.
- **app/program/[id]/program-actions.tsx:** Duplicate, Archive, Unarchive (when `isArchived`); `handleDuplicate`, `handleArchive`, `handleUnarchive`.
- **app/workout/[id]/page.tsx:** Renders `RestTimer` above `WorkoutLogClient`.
- **app/workout/[id]/workout-log-client.tsx:** Fetches recommendation when exercise expanded; shows suggestion; passes `lastWeight` for autofill when no template weight; `logSet` sends `isWarmup`; SetRow has +/- for reps/weight, warm-up checkbox, and `onLog(..., isWarmup)`.
- **app/layout.tsx:** Nav link to `/history`.
- **README.md:** V2 feature list, run instructions, tests, layout.

---

## 5. File-by-file summary of major changes

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `Program.archivedAt`; `ExerciseOverride.note`; `LoggedSet.isWarmup`. |
| `app/api/programs/route.ts` | GET: filter by archived / archived-only. |
| `app/api/programs/[id]/route.ts` | PATCH: name + archive; POST: duplicate. |
| `app/api/log/route.ts` | POST: accept and store `isWarmup`. |
| `app/api/sessions/[id]/overrides/route.ts` | GET: include note; POST: accept note. |
| `app/api/parse/route.ts` | CSV branch for read. |
| `app/api/workout-day/[id]/route.ts` | PATCH: update day name. |
| `app/api/exercises/[id]/route.ts` | New: PATCH exercise (name, substitutions). |
| `app/api/exercises/[id]/recommendation/route.ts` | New: GET suggestion. |
| `app/api/exercises/[id]/history/route.ts` | New: GET logged sets for exercise. |
| `app/api/history/exercises/route.ts` | New: GET exercises with history. |
| `lib/progression/recommend.ts` | New: progression suggestion logic. |
| `components/rest-timer.tsx` | New: rest timer component. |
| `app/page.tsx` | ProgramsList + archived section; two fetches. |
| `app/programs-list.tsx` | New: list of program cards. |
| `app/program/[id]/page.tsx` | Pass `isArchived` to ProgramActions. |
| `app/program/[id]/program-actions.tsx` | Duplicate, Archive, Unarchive. |
| `app/workout/[id]/page.tsx` | Render RestTimer. |
| `app/workout/[id]/workout-log-client.tsx` | Recommendation, +/- , warm-up, autofill last weight. |
| `app/layout.tsx` | History nav link. |
| `app/import/page.tsx` | accept `.csv`. |
| `app/history/page.tsx` | New: history index. |
| `app/history/exercise/[id]/page.tsx` | New: exercise history page. |
| `app/history/exercise/[id]/history-client.tsx` | New: client list by date. |
| `lib/import/__tests__/parse-sets.test.ts` | New: parse-sets tests. |
| `lib/progression/__tests__/recommend.test.ts` | New: progression tests. |
| `vitest.config.ts` | New: Vitest config. |
| `package.json` | test scripts; vitest devDependency. |
| `README.md` | V2 features, setup, tests, layout. |

---

## 6. Schema changes / migrations

- **Program:** `archivedAt DateTime?` (optional).
- **ExerciseOverride:** `note String?` (optional).
- **LoggedSet:** `isWarmup Boolean? @default(false)` (optional).

No separate migration files; applied with:

```bash
npx prisma generate
npx prisma db push
```

SQLite: `db push` applies the diff. For production, you can generate a migration with `npx prisma migrate dev` if you use migrations.

---

## 7. Assumptions made

- Single-user; no auth or program visibility by user.
- “Edit program” means rename program, rename day, duplicate, archive/unarchive, and edit exercise name/substitutions via API; no full in-app “edit mode” for week/day/exercise tree.
- “Manual program creation” and “full flexible import with correction UI” deferred to keep scope manageable.
- Progression logic is heuristic (hit top of range at target RIR → suggest small increase; big miss → stay/reduce); no ML or complex analytics.
- History is per exercise (by exercise id); no global “activity feed” or charts in V2.
- Rest timer is in-memory only (no persistence).
- Override `note` is in API/schema only; UI for session exercise notes can be added later.
- Vitest for unit tests; no E2E or API integration tests in this pass.

---

## 8. Known limitations

- **Import:** No generic “flexible” parser; no row classifier, normalizer, or preview correction UI for ambiguous rows. CSV is supported via same xlsx path; no dedicated CSV parser or warnings array.
- **Program editing:** No UI for editing day name or exercise name/substitutions from the program or workout screen; only APIs exist. No UI for editing template sets (targetReps/Weight/RIR).
- **Manual program:** No “Create program” flow or empty-program builder.
- **Workout:** No autosave of in-progress sets (only “Log”); no skip/reorder UI; override note not shown in UI; rest timer state is lost on refresh.
- **History:** No charts or trend views; list only.
- **Archived:** Archived programs still open and function; unarchive is on program page. No “restore” from a separate archive view.

---

## 9. Recommended V3 roadmap

1. **Import:** Flexible parser path: raw reader → row/block classifier → value normalizer → canonical IR; optional warnings and preview correction (day name, exercise name, sets, RIR, notes, substitutions) before save.
2. **Program editing UI:** In program view, edit day name (e.g. inline or modal); in workout or program view, edit exercise name and substitutions; edit template sets (target reps/weight/RIR) per exercise.
3. **Manual program:** “New program” flow: name, add weeks/days, add exercises and sets, save.
4. **Workout:** Autosave draft sets (e.g. debounced or on blur); optional “Skip” and “Reorder” for session; show and edit override note in UI; persist rest timer (e.g. localStorage or session).
5. **History/analytics:** Per-exercise trend (e.g. weight/reps over time); optional minimal charts; “best” weight/reps and simple progress indicators.
6. **Resilience:** More robust parsing (repeated headers, blank rows, minor column name variants); store parse warnings and skipped rows for review.

---

## 10. Exact commands to run locally

```bash
# Install dependencies
npm install

# Environment (create .env if needed)
# DATABASE_URL="file:./dev.db"

# Generate Prisma client and apply schema
npx prisma generate
npx prisma db push

# Run tests
npm run test

# Start dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Optional:

```bash
# Production build
npm run build
npm run start

# Inspect DB
npx prisma studio
```
