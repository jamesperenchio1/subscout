-- SubScout Phase 1 schema
-- Run this in the Supabase SQL editor AFTER installing the Auth.js
-- Supabase adapter schema (which creates the `next_auth` schema and
-- the `users`, `accounts`, `sessions`, `verification_tokens` tables).
--
-- Reference: https://authjs.dev/getting-started/adapters/supabase

-- 1. Extend auth.js users with our app fields ---------------------------
alter table next_auth.users add column if not exists home_currency text default 'USD';
alter table next_auth.users add column if not exists timezone      text default 'UTC';
alter table next_auth.users add column if not exists plan          text default 'free';

-- 2. App tables in the public schema -----------------------------------
create table if not exists public.connected_accounts (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references next_auth.users(id) on delete cascade,
  google_email            text not null,
  google_refresh_token    text not null,                 -- AES-256-GCM encrypted
  is_primary              boolean default true,
  last_scanned_at         timestamptz,
  scanned_through_date    date,                          -- oldest date covered by a scan
  emails_scanned_count    int  default 0,
  subs_found_count        int  default 0,
  created_at              timestamptz default now(),
  unique (user_id, google_email)
);

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references next_auth.users(id) on delete cascade,
  connected_account_id    uuid not null references public.connected_accounts(id) on delete cascade,
  service_name            text not null,
  amount                  numeric(12,2),
  currency                text,
  billing_cycle           text,                          -- monthly|annual|weekly|one_time|unknown
  next_renewal_date       date,
  last_billed_date        date,
  email_used              text,
  status                  text default 'active',
  cancellation_link       text,
  category                text,
  source_email_id         text,                          -- gmail msg id
  confidence_score        numeric(3,2),
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (user_id, service_name)
);

create index if not exists subscriptions_user_renewal_idx
  on public.subscriptions (user_id, next_renewal_date);

-- 3. Row-Level Security ------------------------------------------------
-- We perform all writes from server code using the service role, which
-- bypasses RLS. RLS is enforced for the anon / authenticated roles so
-- that browser-side queries (e.g. via a future client) only see the
-- caller's rows. auth.uid() returns the Supabase JWT subject; with the
-- Auth.js adapter the user id in next_auth.users matches it.

alter table public.connected_accounts enable row level security;
alter table public.subscriptions      enable row level security;

drop policy if exists "own connected_accounts" on public.connected_accounts;
create policy "own connected_accounts"
  on public.connected_accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own subscriptions" on public.subscriptions;
create policy "own subscriptions"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
