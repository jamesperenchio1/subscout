-- V2 Rebuild — drops legacy tables, introduces evidence-based detection schema.
drop table if exists public.subscriptions cascade;
drop table if exists public.connected_accounts cascade;
create extension if not exists vector;

create table public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,
  last_history_id text,
  scanned_through_date date,
  created_at timestamptz default now(),
  unique (user_id, google_email)
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  bank_id text not null,
  display_name text,
  statement_password_encrypted text,
  sender_email_pattern text not null,
  created_at timestamptz default now()
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  gmail_account_id uuid references public.gmail_accounts(id) on delete cascade,
  gmail_message_id text not null,
  subject text,
  sender_email text,
  sender_domain text,
  sent_at timestamptz,
  event_type text,
  service_name_raw text,
  service_brand text,
  amount numeric(12,2),
  currency text,
  payment_source text,
  confidence numeric(3,2),
  embedding vector(384),
  cluster_id uuid,
  raw_extract jsonb,
  created_at timestamptz default now(),
  unique (user_id, gmail_message_id)
);
create index email_events_cluster_idx on public.email_events(cluster_id);
create index email_events_user_idx on public.email_events(user_id, sent_at desc);

create table public.bank_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  statement_period_start date,
  statement_period_end date,
  charge_date date,
  merchant_raw text,
  merchant_brand text,
  amount numeric(12,2),
  currency text default 'THB',
  card_last4 text,
  created_at timestamptz default now()
);
create index bank_charges_user_idx on public.bank_charges(user_id, charge_date desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  service_brand text not null,
  payment_source text not null,
  amount numeric(12,2),
  currency text,
  billing_cycle text,
  next_renewal_date date,
  last_charge_date date,
  trial_ends_at date,
  status text not null default 'possible',
  evidence_strength text not null,
  cancellation_link text,
  category text,
  brand_logo_url text,
  user_overrides jsonb default '{}'::jsonb,
  detected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, service_brand, payment_source)
);

create table public.subscription_evidence (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  email_event_id uuid references public.email_events(id) on delete cascade,
  bank_charge_id uuid references public.bank_charges(id) on delete cascade,
  added_at timestamptz default now()
);
create index subscription_evidence_sub_idx on public.subscription_evidence(subscription_id);

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  kind text not null,
  status text not null default 'queued',
  progress_current int default 0,
  progress_total int default 0,
  stage text,
  result jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);
create index scan_jobs_user_idx on public.scan_jobs(user_id, created_at desc);

create table public.brand_cache (
  domain text primary key,
  brand_name text,
  logo_url text,
  category text,
  fetched_at timestamptz default now()
);

alter table public.gmail_accounts enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.email_events enable row level security;
alter table public.bank_charges enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_evidence enable row level security;
alter table public.scan_jobs enable row level security;

create policy "own gmail_accounts" on public.gmail_accounts for all using (auth.uid() = user_id);
create policy "own bank_accounts" on public.bank_accounts for all using (auth.uid() = user_id);
create policy "own email_events" on public.email_events for all using (auth.uid() = user_id);
create policy "own bank_charges" on public.bank_charges for all using (auth.uid() = user_id);
create policy "own subscriptions" on public.subscriptions for all using (auth.uid() = user_id);
create policy "own scan_jobs" on public.scan_jobs for all using (auth.uid() = user_id);
create policy "own subscription_evidence" on public.subscription_evidence for all using (
  exists (select 1 from public.subscriptions s where s.id = subscription_id and s.user_id = auth.uid())
);
