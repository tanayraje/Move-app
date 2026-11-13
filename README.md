# Move

A travel itinerary app for groups: timeline, documents, shared costs and places for each trip. Installable on a phone (PWA), with push reminders before each timeline item.

Live at https://move-itenerary.vercel.app

## Stack

- **App:** React 19, TypeScript, Vite, Tailwind 4, TanStack Query, wouter, framer-motion
- **Backend:** Supabase (Postgres with row access rules, Auth with Google sign-in, Storage, Edge Functions)
- **Hosting:** Vercel, deployed from `master`
- **Android shell:** Capacitor (`artifacts/move/android`)
- **Package manager:** pnpm (workspace)

There is no custom server. The app talks to Supabase directly, so the database access rules are the only thing protecting trip data.

## Folder map

```text
artifacts/move/                 The app
  public/sw.js                  The one service worker: app shell caching and push
  src/pages/                    Home, Profile, JoinInvite, TripDashboard
  src/pages/tabs/               The five trip tabs: Overview, Timeline (ItineraryTab), Docs, Costs, Places
  src/pages/tabs/itinerary/     Parts of the Timeline tab
  src/hooks/use-store.ts        Every read and write to Supabase
  src/lib/query-client.ts       Query setup, failure messages, offline cache
  src/lib/expense-ledger.ts     Who owes whom
  src/lib/*.test.ts             Tests
supabase/
  functions/notify-next/        Push reminders, run every minute by pg_cron
  functions/hero-image/         Trip cover photo
  functions/city-image/         City photo for a day
  migrations/                   SQL, in the order it should be run
  push-notifications.sql        Already applied: push tables and the cron job
```

## Run it

```sh
pnpm install
pnpm dev          # start the app
pnpm check        # typecheck + tests
pnpm build        # production build
```

The app needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `artifacts/move/.env`).

Every push runs typecheck, tests and a build on GitHub (`.github/workflows/check.yml`).

## Database changes

SQL lives in `supabase/migrations`. Each file says at the top whether it has been applied. Nothing is applied automatically: review a file, then run it in the Supabase SQL editor.

Known gap: the tables `trips`, `trip_members`, `itinerary_items`, `documents`, `expenses`, `places`, `profiles`, their access rules, and the functions `join_trip_by_code`, `get_trip_members` and `remove_trip_member` exist only in the live database. They still need to be exported into `supabase/migrations`.

## Deploy a function

```sh
supabase functions deploy notify-next --no-verify-jwt
supabase functions deploy hero-image
supabase functions deploy city-image
```

`notify-next` checks its own `x-cron-secret` header. Secrets (VAPID keys, cron secret) live in the `app_secrets` table, not in this repo.

## How it behaves

- **After a deploy:** the page HTML is always fetched fresh, so an installed phone gets the new version on its next open.
- **Offline, reading:** the last data each screen loaded is kept on the phone for a week, so a trip opens read-only.
- **Offline, writing:** saves are never queued. A save fails at once, the screen goes back to how it was, and a message says what happened.
- **Reminders:** 2 hours before flights and trains, 15 minutes before everything else. Times are local to the place: travel uses the place it leaves from, everything else uses the day's city.
- **Documents:** files sit in the `trip-documents` bucket as `<trip_id>/<document_id>_<file name>`. `documents.file_url` holds that path (older rows hold a full link; both work).

## Standing rules

**Repo**
- Inspect the current repo state before changing anything.
- Commit and push straight to `master`. Never create a branch.
- `pnpm-workspace.yaml` stays unstaged.

**Delivery**
- Never give full code unless asked. Only the files that changed.
- Show changes as "code to replace" and "code to replace with", whole blocks, no ellipses or placeholders. No zips, no patch files.
- For visual changes, show mockups before code.

**Design**
- Light mode, original palette. Glass like iOS liquid glass, the same strength everywhere, used only on buttons, bars and menus, never on content cards.
- No emojis anywhere.
- All times shown and entered in 12-hour AM/PM.
- Colour stays consistent by type across the app: purple for stays, no yellow outside food.
- Motion is subtle: one card entrance, the live flight-progress plane, everything else still.
- Calm over loud. If a screen "screams", it is wrong.
