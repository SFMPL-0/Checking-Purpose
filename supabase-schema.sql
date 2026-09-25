-- ============================================================================
-- Freight Profit & Tax Calculator — Supabase schema
-- Run this once in your project's SQL Editor:
-- https://supabase.com/dashboard/project/hvqgxbxzzbyklzyerfpf/sql/new
--
-- Scale note: at ~20-30 vehicles/day, most of that volume now goes through
-- calculation_groups (bulk entry) and saved_calculations (explicit saves),
-- not calculation_history. calculation_history only logs a checkpoint when
-- you navigate away from the calculator with a real trip entered — roughly
-- one row per trip actually worked on, not one row per keystroke — plus it
-- has a retention/cleanup function below so it doesn't grow forever. See
-- the "Retention" section near the bottom.
-- ============================================================================

-- 1) Key/value table for the "current" working state: the active input,
--    expenses, interest tranches, TDS settings, general settings and the
--    scenario list. One row per key.
create table if not exists public.app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) One row per saved trip/calculation snapshot (History tab). This is a
--    real, permanent business record — never auto-deleted.
--
--    client_name/truck_type/from_location/to_location are stored as plain
--    text columns copied from the Client/Truck Type/Location master lists
--    at the time the trip was saved — deliberately NOT a foreign key to
--    clients/truck_types/locations. That's intentional: if a client is
--    later renamed or a truck type deleted from the master list, every
--    historical trip that referenced it keeps showing exactly what was
--    true at the time, instead of silently changing or breaking. The
--    master tables exist purely to power the autocomplete suggestions.
create table if not exists public.saved_calculations (
  id                text primary key,
  name              text not null,
  trip_number       text,
  notes             text,
  client_name       text,
  truck_type        text,
  from_location     text,
  to_location       text,
  input             jsonb not null,
  expenses          jsonb not null,
  interest_tranches jsonb not null,
  tds_settings      jsonb not null,
  general_settings  jsonb not null,
  result            jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- If you created this table before client_name/truck_type/from_location/
-- to_location existed, this adds them without losing any data:
alter table public.saved_calculations add column if not exists client_name text;
alter table public.saved_calculations add column if not exists truck_type text;
alter table public.saved_calculations add column if not exists from_location text;
alter table public.saved_calculations add column if not exists to_location text;
alter table public.saved_calculations add column if not exists truck_number text;

create index if not exists idx_saved_calculations_created_at
  on public.saved_calculations (created_at desc);

create index if not exists idx_saved_calculations_trip_number
  on public.saved_calculations (trip_number);

create index if not exists idx_saved_calculations_client_name
  on public.saved_calculations (client_name);

-- 3) Automatic, unnamed calculation checkpoint log — a lightweight safety
--    net so a trip's numbers aren't lost even if you never click "Save",
--    WITHOUT logging every keystroke. The app only writes here when you
--    navigate away from the calculator with both a selling and buying
--    price entered, and skips it entirely if nothing changed since the
--    last checkpoint. This is what powers the "Auto Log" tab.
--
--    trip_number/selling_price/buying_price/net_profit/client_name/
--    truck_type are stored as plain indexed columns (not just inside the
--    `result`/`input` JSONB) so listing, searching and paging through a
--    long history stays fast without Postgres parsing JSON on every row.
create table if not exists public.calculation_history (
  id                text primary key,
  trip_number       text,
  client_name       text,
  truck_type        text,
  selling_price     numeric,
  buying_price      numeric,
  net_profit        numeric,
  input             jsonb not null,
  expenses          jsonb not null,
  interest_tranches jsonb not null,
  tds_settings      jsonb not null,
  general_settings  jsonb not null,
  result            jsonb not null,
  created_at        timestamptz not null default now()
);

-- If you created this table with an earlier version of this schema, this
-- adds the missing columns without losing any data:
alter table public.calculation_history add column if not exists trip_number text;
alter table public.calculation_history add column if not exists client_name text;
alter table public.calculation_history add column if not exists truck_type text;
alter table public.calculation_history add column if not exists selling_price numeric;
alter table public.calculation_history add column if not exists buying_price numeric;
alter table public.calculation_history add column if not exists net_profit numeric;

-- Primary access pattern: "give me the latest page of history" and
-- "give me everything older than the last row I already have" (keyset
-- pagination) — both satisfied by a single descending index on created_at.
create index if not exists idx_calculation_history_created_at
  on public.calculation_history (created_at desc);

-- Lets "search by trip/LR number" run as an index lookup instead of a full
-- table scan once you have a large history.
create index if not exists idx_calculation_history_trip_number
  on public.calculation_history (trip_number);

-- 4) Multi-vehicle bulk entry batches. One row per "Add Multiple Vehicles"
--    submission: the individual vehicle rows are kept (as JSONB) plus the
--    aggregated totals/result, so you can both drill into a batch and
--    quickly sum up a whole day's business.
--
--    group_date is a plain 'YYYY-MM-DD' TEXT column (not the row's
--    timestamp) specifically so "how much did I do on this day" is an
--    indexed equality/range lookup instead of a per-row date() computation.
create table if not exists public.calculation_groups (
  id                  text primary key,
  group_name          text not null,
  group_date          text not null, -- 'YYYY-MM-DD'
  vehicle_count       integer not null default 0,
  total_selling_price numeric not null default 0,
  total_buying_price  numeric not null default 0,
  net_profit          numeric not null default 0,
  vehicles            jsonb not null,
  expenses            jsonb not null,
  interest_tranches   jsonb not null,
  tds_settings        jsonb not null,
  general_settings    jsonb not null,
  result              jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Powers "show me everything for this day" / daily totals.
create index if not exists idx_calculation_groups_group_date
  on public.calculation_groups (group_date);

-- Powers the newest-first list + keyset pagination in the Vehicle Groups tab.
create index if not exists idx_calculation_groups_created_at
  on public.calculation_groups (created_at desc);

-- 5) Master data: Client Name / Truck Type / From-To Location suggestion
--    lists that power the searchable "type to filter, or add new" dropdowns
--    in Core Trip Pricing. These are intentionally NOT referenced by
--    foreign key from saved_calculations/calculation_groups/
--    calculation_history — see the comment on saved_calculations above for
--    why. A unique index on lower(name) prevents duplicate master records
--    (e.g. "Mumbai" and "mumbai" as two separate entries) regardless of the
--    casing someone types.
create table if not exists public.clients (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_clients_name_unique
  on public.clients (lower(name));

create table if not exists public.truck_types (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_truck_types_name_unique
  on public.truck_types (lower(name));

-- Shared list for both "From" and "To" — a place is a place either way.
create table if not exists public.locations (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_locations_name_unique
  on public.locations (lower(name));

-- Optional but recommended once any of these lists grows into the
-- thousands: pg_trgm lets ILIKE '%partial%' searches use a GIN index
-- instead of scanning the whole table. Safe to run anytime; skip if your
-- Supabase plan doesn't allow creating extensions.
-- create extension if not exists pg_trgm;
-- create index if not exists idx_clients_name_trgm on public.clients using gin (name gin_trgm_ops);
-- create index if not exists idx_truck_types_name_trgm on public.truck_types using gin (name gin_trgm_ops);
-- create index if not exists idx_locations_name_trgm on public.locations using gin (name gin_trgm_ops);

-- ============================================================================
-- Retention: keep calculation_history from growing without bound
--
-- Now that logging is checkpoint-based (see the comment on
-- calculation_history above) this table grows far slower than before, but
-- it's still an auto-generated log rather than a permanent record, so it's
-- safe to prune. This function deletes rows older than `retention_days`
-- (default 180 ≈ 6 months). saved_calculations and calculation_groups are
-- never touched by this — those are explicit, permanent business records.
-- ============================================================================
create or replace function public.cleanup_old_calculation_history(
  retention_days integer default 180
) returns integer
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from public.calculation_history
  where created_at < now() - (retention_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Run it manually any time, e.g. to prune anything older than a year:
--   select public.cleanup_old_calculation_history(365);
--
-- To run it automatically every night (needs the pg_cron extension, which
-- is available on paid Supabase plans under Database → Extensions):
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'cleanup-calculation-history',
--     '0 3 * * *', -- 3am daily
--     $$select public.cleanup_old_calculation_history(180)$$
--   );

-- ============================================================================
-- Row Level Security
--
-- The app talks to Supabase using the public "anon" (publishable) key, which
-- is embedded in the JS bundle and visible to anyone who opens the app.
-- There is no login system, so this schema treats the data as belonging to
-- a single trusted user/team rather than per-account data. RLS is still
-- enabled with explicit policies (rather than left off) so access is a
-- deliberate, visible choice here instead of a Supabase security-advisor
-- warning you have to silence later.
--
-- If you ever make this app public-facing or multi-user, add Supabase Auth
-- and rewrite these policies to filter by auth.uid() instead of "true".
-- ============================================================================

alter table public.app_state enable row level security;
alter table public.saved_calculations enable row level security;
alter table public.calculation_history enable row level security;
alter table public.calculation_groups enable row level security;
alter table public.clients enable row level security;
alter table public.truck_types enable row level security;
alter table public.locations enable row level security;

drop policy if exists "app_state_select" on public.app_state;
create policy "app_state_select" on public.app_state
  for select using (true);

drop policy if exists "app_state_insert" on public.app_state;
create policy "app_state_insert" on public.app_state
  for insert with check (true);

drop policy if exists "app_state_update" on public.app_state;
create policy "app_state_update" on public.app_state
  for update using (true) with check (true);

drop policy if exists "saved_calculations_select" on public.saved_calculations;
create policy "saved_calculations_select" on public.saved_calculations
  for select using (true);

drop policy if exists "saved_calculations_insert" on public.saved_calculations;
create policy "saved_calculations_insert" on public.saved_calculations
  for insert with check (true);

drop policy if exists "saved_calculations_update" on public.saved_calculations;
create policy "saved_calculations_update" on public.saved_calculations
  for update using (true) with check (true);

drop policy if exists "saved_calculations_delete" on public.saved_calculations;
create policy "saved_calculations_delete" on public.saved_calculations
  for delete using (true);

drop policy if exists "calculation_history_select" on public.calculation_history;
create policy "calculation_history_select" on public.calculation_history
  for select using (true);

drop policy if exists "calculation_history_insert" on public.calculation_history;
create policy "calculation_history_insert" on public.calculation_history
  for insert with check (true);

drop policy if exists "calculation_history_delete" on public.calculation_history;
create policy "calculation_history_delete" on public.calculation_history
  for delete using (true);

drop policy if exists "calculation_groups_select" on public.calculation_groups;
create policy "calculation_groups_select" on public.calculation_groups
  for select using (true);

drop policy if exists "calculation_groups_insert" on public.calculation_groups;
create policy "calculation_groups_insert" on public.calculation_groups
  for insert with check (true);

drop policy if exists "calculation_groups_update" on public.calculation_groups;
create policy "calculation_groups_update" on public.calculation_groups
  for update using (true) with check (true);

drop policy if exists "calculation_groups_delete" on public.calculation_groups;
create policy "calculation_groups_delete" on public.calculation_groups
  for delete using (true);

drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients for select using (true);
drop policy if exists "clients_insert" on public.clients;
create policy "clients_insert" on public.clients for insert with check (true);
drop policy if exists "clients_update" on public.clients;
create policy "clients_update" on public.clients for update using (true) with check (true);
drop policy if exists "clients_delete" on public.clients;
create policy "clients_delete" on public.clients for delete using (true);

drop policy if exists "truck_types_select" on public.truck_types;
create policy "truck_types_select" on public.truck_types for select using (true);
drop policy if exists "truck_types_insert" on public.truck_types;
create policy "truck_types_insert" on public.truck_types for insert with check (true);
drop policy if exists "truck_types_update" on public.truck_types;
create policy "truck_types_update" on public.truck_types for update using (true) with check (true);
drop policy if exists "truck_types_delete" on public.truck_types;
create policy "truck_types_delete" on public.truck_types for delete using (true);

drop policy if exists "locations_select" on public.locations;
create policy "locations_select" on public.locations for select using (true);
drop policy if exists "locations_insert" on public.locations;
create policy "locations_insert" on public.locations for insert with check (true);
drop policy if exists "locations_update" on public.locations;
create policy "locations_update" on public.locations for update using (true) with check (true);
drop policy if exists "locations_delete" on public.locations;
create policy "locations_delete" on public.locations for delete using (true);
