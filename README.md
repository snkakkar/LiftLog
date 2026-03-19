# LiftLog (V2)

A single-user personal fitness app for uploading Excel/CSV workout programs and logging sets (reps, weight, RIR). No authentication; personal use only.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix-based components)
- **Prisma** + **SQLite**

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Database

Create `.env` in the project root (or copy from `.env.example`):

```
DATABASE_URL="file:./dev.db"
```

Generate the Prisma client and create the SQLite DB:

```bash
npx prisma generate
npx prisma db push
```

If the home page shows an error banner or nothing loads, ensure the DB file exists and the schema is applied (run `npx prisma db push` again).

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env` if you need server-side fetches to your API.

### Run on your phone

**Option A — Tunnel (most reliable, works even if Wi‑Fi IP doesn’t)**  
No firewall or same-network issues. You get a public URL that works from your phone (or anywhere).

**A1. localhost.run (no install, URL appears right away)**  
If the page is blank or “nothing loads” when using the tunnel with `npm run dev`, use **production mode** (no HMR/WebSocket), then tunnel:

1. In one terminal, build and run the app:
   ```bash
   npm run build && npm run start
   ```
2. In a **second terminal**, run:
   ```bash
   ssh -R 80:localhost:3000 nokey@localhost.run
   ```
3. The terminal will print a URL like `https://abc123.localhost.run`. Open that URL on your phone.

(You can also try `npm run dev` first; if the page loads but content is blank, switch to `npm run build && npm run start` and tunnel again.)

**A2. ngrok (if you prefer)**  
1. Sign up at [ngrok.com](https://ngrok.com) (free) and get your auth token.  
2. Start the app: `npm run dev`  
3. In a second terminal: `npx ngrok http 3000`  
4. Use the `https://...ngrok-free.app` URL shown.

**Option B — Same Wi‑Fi (if tunnel isn’t needed)**  
1. Start the dev server so it’s reachable on your network:
   ```bash
   npm run dev:lan
   ```
2. Get your Mac’s IP: **System Settings → Network → Wi‑Fi → Details**, or in Terminal: `ipconfig getifaddr en0`
3. On your phone (same Wi‑Fi), open: `http://<YOUR_IP>:3000` (e.g. `http://192.168.1.5:3000`).

If that doesn’t work: **System Settings → Network → Firewall** — turn the firewall off temporarily to test, or add Node to “Allow incoming connections”. Some routers also block device-to-device access; in that case use Option A (tunnel).

**Option C — Deploy (use from anywhere, permanent)**  
Deploy to [Vercel](https://vercel.com) (free for personal projects) so you get a URL you can open on your phone from any network:
1. Push your code to GitHub.
2. Sign in at [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. Add env var: `DATABASE_URL` — for Vercel you’ll need a hosted DB (e.g. [Turso](https://turso.tech), [PlanetScale](https://planetscale.com), or Vercel Postgres). For SQLite you can use [Vercel’s blob SQLite](https://vercel.com/docs/storage/vercel-blob#sqlite) or switch to a hosted SQL provider.
4. Deploy; use the generated URL (e.g. `https://your-app.vercel.app`) on your phone.

## Run tests

```bash
npm run test
```

## Features (V2)

- **Import:** Upload Excel or CSV → parse (V1 table or Min-Max style) → preview → save. Supports program name, weeks, days, exercises, sets, RIR, substitutions.
- **Programs:** List active programs; archive/restore; duplicate; rename; delete. Archived programs appear in a separate section on the home page.
- **Workout:** Open a day → rest timer → log sets with reps, weight, RIR; +/- quick adjust; mark warm-up sets; replace exercise with substitution or custom name; progression suggestions; previous performance.
- **History:** Exercise history page lists exercises you’ve logged; per-exercise view shows past sets by date.

## Import formats

- **V1 (table):** Single sheet with header row: Week, Day, Exercise, Sets (e.g. 3x8). Data rows below.
- **Min-Max (Nippard-style):** Column A = Week N / Full Body / Upper / Lower / Arms-Delts; Column B = exercise name; fixed columns for working sets, load/reps, RIR, substitutions.
- **CSV:** Same structure as Excel; accepted on the Import page.

## Scripts

- `npm run dev` — Start dev server (localhost only).
- `npm run dev:lan` — Start dev server on all interfaces so you can open the app on your phone at `http://<your-ip>:3000` when on the same Wi‑Fi.
- `npm run tunnel` — Create a public URL via localhost.run (run `npm run dev` in another terminal first; the URL is printed in this terminal).
- `npm run build` — Build for production.
- `npm run start` — Run production server.
- `npm run test` — Run tests.
- `npx prisma studio` — Open Prisma Studio.
- `npx prisma db push` — Apply schema changes.

## Project layout

- `app/` — Pages (home, import, program, workout, history) and API routes.
- `app/api/` — parse, import, programs (GET/PATCH/DELETE/POST duplicate), workout-day, sessions, log, previous-log, exercises/[id]/recommendation, exercises/[id]/history, history/exercises.
- `lib/import/` — Canonical types, set parser, parser-v1, parser-minmax, pipeline, to-db.
- `lib/progression/` — Recommendation logic from prior logs + prescription.
- `components/` — UI (rest timer, shadcn components).
