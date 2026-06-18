-- ============================================================
-- UTANG TRACKER — SUPABASE DATABASE SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. DEBTS TABLE
create table if not exists debts (
  id text primary key,
  name text not null,
  total numeric default 0,
  min numeric default 0,
  goal numeric default 0,
  saved numeric default 0,
  status text default '',
  created_at timestamptz default now()
);

-- 2. DUES TABLE
create table if not exists dues (
  id text primary key,
  name text not null,
  date text not null,
  amount numeric default 0,
  paid boolean default false,
  created_at timestamptz default now()
);

-- 3. BUDGET TABLE (single row, id=1)
create table if not exists budget (
  id integer primary key default 1,
  income numeric default 2300,
  food numeric default 1000,
  bills numeric default 300,
  emergency numeric default 200,
  envelopes numeric default 800,
  envelope_split jsonb default '[]'::jsonb
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS) — allows anon access
-- ============================================================
alter table debts enable row level security;
alter table dues enable row level security;
alter table budget enable row level security;

-- Allow all operations for anon key (since this is a personal app)
create policy "Allow all for anon" on debts for all using (true) with check (true);
create policy "Allow all for anon" on dues for all using (true) with check (true);
create policy "Allow all for anon" on budget for all using (true) with check (true);

-- ============================================================
-- INSERT DEFAULT BUDGET ROW
-- ============================================================
insert into budget (id, income, food, bills, emergency, envelopes, envelope_split)
values (
  1, 2300, 1000, 300, 200, 800,
  '[{"name":"GCash","amount":300},{"name":"Sloan","amount":300},{"name":"Maribank","amount":200}]'::jsonb
)
on conflict (id) do nothing;

-- ============================================================
-- INSERT DEFAULT DEBTS
-- ============================================================
insert into debts (id, name, total, min, goal, saved, status) values
  ('d1', 'Atome Cash',    20725.85, 6273.17, 6273.17, 0, 'Waiting for Upwork'),
  ('d2', 'GCash',          7399.56, 1057.08, 1057.08, 0, ''),
  ('d3', 'Sloan',         17822.32, 2227.79, 2227.79, 0, ''),
  ('d4', 'Maribank',      42876.30, 3949.13, 3949.13, 0, ''),
  ('d5', 'Giem''s Gcash',  1510.11, 1510.11, 1510.11, 0, ''),
  ('d6', 'Maya',           8942.23, 8942.23,       0, 0, '')
on conflict (id) do nothing;

-- ============================================================
-- INSERT DEFAULT DUE DATES
-- ============================================================
insert into dues (id, name, date, amount, paid) values
  ('du1',  'Axell''s savings',      '2026-06-18',    200.00, false),
  ('du2',  'Electricity',           '2026-06-20',   3861.25, false),
  ('du3',  'Sloan',                 '2026-06-24',   2227.82, false),
  ('du4',  'Alahas',                '2026-06-25',      0.00, false),
  ('du5',  'Converge',              '2026-06-26',   1250.00, false),
  ('du6',  'Maya',                  '2026-06-30',   6619.43, false),
  ('du7',  'Pldt',                  '2026-07-02',   1399.00, false),
  ('du8',  'Sloan 3 (6months)',     '2026-07-04',   2836.14, false),
  ('du9',  'Oven',                  '2026-07-07',   3546.87, false),
  ('du10', 'Sloan 2 (3months)',     '2026-07-07',   2309.01, false),
  ('du11', 'Maribank',              '2026-07-09',   3949.17, false),
  ('du12', 'Menjel Atome',         '2026-07-15',   4075.00, false),
  ('du13', 'Shoppe VIP renewal',   '2026-07-15',      0.00, false)
on conflict (id) do nothing;
