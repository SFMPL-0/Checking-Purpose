# Freight Profit & Tax Calculator

Professional freight business profit, interest, expenses and TDS claim
calculator with configurable financial engines, scenarios, and reports. Data
is persisted to Supabase (Postgres) so it syncs across devices and browsers.

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env` if you want to point the app at
   your own Supabase project instead of the default one already configured
   in `src/services/supabaseClient.ts`.
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

## Deploy: GitHub → Vercel

1. **Push this project to a GitHub repository.**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. **Import the repo in Vercel.**
   - Go to https://vercel.com/new
   - Select "Import Git Repository" and choose your repo
   - Vercel auto-detects this as a Vite project:
     - Build Command: `npm run build`
     - Output Directory: `dist`
   - No environment variables are required (Supabase URL/key already have
     working defaults). If you want to use your own Supabase project instead,
     add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under
     Project Settings → Environment Variables.
3. Click **Deploy**. Every subsequent push to `main` auto-deploys.

That's it — no other services or accounts are needed.

## Data storage (Supabase)

All calculations, settings and scenarios are persisted to Supabase instead of
localStorage, so they sync across devices/browsers.

1. In your Supabase project's SQL Editor, run [`supabase-schema.sql`](supabase-schema.sql)
   once to create the `app_state`, `saved_calculations` and
   `calculation_history` tables (with their indexes).
2. The project URL and anon/publishable key are already set as defaults in
   `src/services/supabaseClient.ts`. To point at a different Supabase project,
   set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (via `.env` locally, or
   as Environment Variables in Vercel) instead of editing the source file.
3. That's it — the app fetches everything from Supabase on load and saves
   changes back automatically (debounced ~600ms after you stop typing).

A trip is also auto-logged as a checkpoint to `calculation_history`
whenever you navigate away from the calculator with a real trip entered
(separate from the explicit "Save Current Trip" button) — browsable from
the "Auto Log" tab under History & Reports. Unlike an earlier version of
this app, it does **not** log on every keystroke — only once per trip you
actually work on — and old entries can be pruned with the
`cleanup_old_calculation_history()` SQL function in `supabase-schema.sql`
(see the comments there for a scheduled/manual cleanup option).

### Multi-Vehicle Entry (bulk entry)

For days with many vehicles/trips, use the **Multi-Vehicle Entry** tab
instead of the full calculator flow one-by-one:

1. Add a row per vehicle (vehicle/LR number, selling price, buying price).
2. Their selling and buying prices are summed automatically.
3. The rest of the calculation (expenses, interest, TDS, tax) runs once on
   the totals, using your current Engine Settings.
4. Save the whole batch — it's stored in Supabase's `calculation_groups`
   table, tagged with the date you pick.

Under History & Reports → **Vehicle Groups**, you get:
- A **Daily Totals** table — total vehicles, selling, buying and net profit
  per day (last 7/30/90 days), across every batch logged that day.
- The full list of batches, each expandable to see every individual
  vehicle's numbers, with options to reopen a batch's totals into the
  calculator or delete it.

### Engine Settings password

The Engine Settings tab (Expenses, Interest, TDS, Tax config) is locked
behind a password (`1991`, set in `src/components/SettingsPasswordGate.tsx`)
and re-locks every time you navigate away. This is a client-side deterrent
(the password ships inside the app bundle), not a real security boundary —
change it in that file if you want a different one.

### Core Trip Pricing: Client, Route, Truck Type

The Dashboard's trip fields now include:
- **Client Name** — searchable dropdown; type to filter, or add a brand new
  client directly from the field.
- **From / To** — replaces the old free-text "Route / Note" field with two
  searchable location fields (both draw from the same shared location list).
- **Truck Type** — searchable dropdown with the same add-new behaviour.

New entries are saved to Supabase (`clients`, `locations`, `truck_types`
tables) and are instantly available in every dropdown afterwards — no page
reload needed. These are plain suggestion lists, not linked by foreign key
to your trip history, so renaming or removing one later never changes a
past trip's saved record (it keeps its own copy of the name as text).

### Core Trip Pricing: Pricing method & Single/Multiple Entry

Selling Price and Buying Price each have a pricing-method toggle:
- **Fixed Amount** — type the amount directly (the original behaviour).
- **Freight × PMT** — enter a Freight Rate and PMT (tonnage/quantity); the
  amount is calculated automatically as Freight Rate × PMT.

A **Single Entry / Multiple Entry** toggle sits above the pricing fields:
- **Single Entry** — one Selling/Buying price for the whole trip, as above.
- **Multiple Entry** — enter as many vehicles as needed (Add Vehicle, +5,
  +10 buttons; Remove per row), each with its own Vehicle Number, Truck
  Type, and independent Selling/Buying pricing method. Total Selling,
  Total Buying and Total Profit are summed automatically and fed straight
  into the Key Financial Summary, Save, Print and every other feature —
  switching modes updates the summary cards immediately, with no separate
  save step needed for this to take effect.

### Print / PDF: hide the formulas

On the Dashboard, a **"Show Formulas in Print/PDF"** checkbox controls
whether the printed report / exported PDF includes the "Formula / Basis"
column explaining how each figure was calculated. Turn it off to hand a
client a clean, amount-only statement.

**Security note:** the anon key is public (it ships inside the app bundle).
The included RLS policies allow anyone with that key to read/write this
data, which is fine for a personal/team tool with no login screen. If you
add user accounts later, tighten the policies in `supabase-schema.sql` to
check `auth.uid()`.
