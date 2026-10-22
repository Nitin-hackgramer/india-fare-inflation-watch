-- Airfare Index India — Supabase schema (run once in Supabase SQL Editor).
-- Columns mirror src/types/index.ts so FastAPI can return rows unchanged.
-- Writes come only from the FastAPI backend using the service_role key (server-side, never in the frontend).

create table if not exists routes (
  id text primary key,                 -- e.g. 'DEL-BOM'
  origin_code text not null,
  destination_code text not null,
  distance_km int,
  traffic_weight numeric not null      -- basket weight from DGCA city-pair passengers, sums to 1
);

create table if not exists airlines (
  code text primary key,               -- IATA, e.g. '6E'
  name text not null,
  source_id text not null
);

create table if not exists data_sources (
  id text primary key,                 -- e.g. 'src-indigo'
  name text not null,
  type text not null check (type in ('airline', 'ota', 'gds', 'feed')),
  configured boolean not null default false
);

-- One row per collection attempt (failed attempts have fare = null).
create table if not exists fare_observations (
  id bigint generated always as identity primary key,
  route_id text not null references routes(id),
  airline_code text not null references airlines(code),
  source_id text not null references data_sources(id),
  observed_date date not null,
  travel_date date not null,
  advance_days smallint not null check (advance_days in (1, 7, 15, 30, 45)),
  fare numeric,
  currency text not null default 'INR',
  collected_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed')),
  error_code text
);
create index if not exists fare_obs_route_date on fare_observations (route_id, observed_date);
create index if not exists fare_obs_source on fare_observations (source_id, collected_at desc);

-- Computed by the backend (same math as src/utils/indexCalculation.ts).
create table if not exists index_values (
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  segment text not null default 'all',   -- 'all' or airline code
  value numeric not null,
  change_pct numeric,
  observation_count int not null,
  method_version text not null,
  computed_at timestamptz not null default now(),
  primary key (period, period_start, segment, method_version)
);

-- Public read-only access (dashboard data is not sensitive). No anon writes.
alter table routes enable row level security;
alter table airlines enable row level security;
alter table data_sources enable row level security;
alter table fare_observations enable row level security;
alter table index_values enable row level security;
create policy "public read" on routes for select using (true);
create policy "public read" on airlines for select using (true);
create policy "public read" on data_sources for select using (true);
create policy "public read" on fare_observations for select using (true);
create policy "public read" on index_values for select using (true);

-- Seed reference data (same as demo).
insert into routes values
  ('DEL-BOM','DEL','BOM',1148,0.26), ('DEL-BLR','DEL','BLR',1740,0.21), ('BOM-BLR','BOM','BLR',842,0.17),
  ('DEL-CCU','DEL','CCU',1305,0.12), ('BLR-HYD','BLR','HYD',500,0.11), ('MAA-DEL','MAA','DEL',1760,0.13)
on conflict do nothing;
insert into data_sources values
  ('src-indigo','IndiGo — airline website','airline',true), ('src-airindia','Air India — airline website','airline',true),
  ('src-aix','Air India Express — airline website','airline',true), ('src-akasa','Akasa Air — airline website','airline',true),
  ('src-spicejet','SpiceJet — airline website','airline',true), ('src-ota-a','OTA source A (placeholder)','ota',false),
  ('src-ota-b','OTA source B (placeholder)','ota',false),
  ('src-amadeus','Amadeus Flight Offers (Enterprise API)','gds',true),
  ('src-feed','Permitted partner feed (CSV)','feed',true)
on conflict do nothing;
insert into airlines values
  ('6E','IndiGo','src-indigo'), ('AI','Air India','src-airindia'), ('IX','Air India Express','src-aix'),
  ('QP','Akasa Air','src-akasa'), ('SG','SpiceJet','src-spicejet')
on conflict do nothing;
