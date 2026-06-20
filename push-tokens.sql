-- ============================================================
-- PUSH TOKENS TABLE
-- Run this in Supabase → SQL Editor
-- Stores FCM tokens for each device so the Edge Function
-- can send push notifications to all registered devices.
-- ============================================================

create table if not exists push_tokens (
  id          bigserial primary key,
  token       text        not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Allow anonymous inserts/updates (the app inserts the token on load)
alter table push_tokens enable row level security;

create policy "Allow anon insert" on push_tokens
  for insert with check (true);

create policy "Allow anon upsert" on push_tokens
  for update using (true) with check (true);

create policy "Allow service role select" on push_tokens
  for select using (true);

-- Index for fast lookups
create index if not exists push_tokens_token_idx on push_tokens (token);
