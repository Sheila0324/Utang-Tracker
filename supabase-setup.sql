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
  type text default 'debt',       -- type of item: debt, bill, savings
  schedule jsonb default null,   -- stores recurring payment schedule + reminder settings
  created_at timestamptz default now()
);

-- If upgrading an existing database, run these to add columns:
-- alter table debts add column if not exists schedule jsonb default null;
-- alter table debts add column if not exists type text default 'debt';

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
  sections jsonb default '[]'::jsonb
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
-- CLEAR ALL DATA (fresh start)
-- ============================================================
-- Wipes all existing debts, dues, and resets budget to zero.
-- Run this in Supabase SQL Editor to clear your database.

delete from debts;
delete from dues;
delete from budget;

-- Insert a blank budget row (id=1) with empty arrays
insert into budget (id, sections)
values (1, '[]'::jsonb)
on conflict (id) do update set
  sections = '[]'::jsonb;

-- ============================================================
-- KEEP-ALIVE: pg_cron Job (run once — prevents free-tier pause)
-- ============================================================
-- Supabase free-tier projects pause after ~1 week of inactivity.
-- This cron job runs a lightweight query every Monday at 08:00 UTC
-- to keep the project alive automatically.
--
-- STEP 1: Enable the pg_cron extension (do this ONCE in SQL editor)
--   Go to: Dashboard → Database → Extensions → search "pg_cron" → Enable
--   OR run the line below:
-- create extension if not exists pg_cron;
--
-- STEP 2: Run the cron job registration below:

select cron.schedule(
  'utang-tracker-keepalive',         -- job name (unique)
  '0 8 * * 1',                        -- every Monday at 08:00 UTC
  $$select count(*) from budget$$     -- lightweight ping query
);

-- To verify the job was created:
-- select * from cron.job;

-- To remove the job if needed:
-- select cron.unschedule('utang-tracker-keepalive');

