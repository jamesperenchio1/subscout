-- User corrections: dismissed patterns and persistent subscription overrides
create table public.dismissed_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references next_auth.users(id) on delete cascade,
  service_brand text,
  payment_source text,
  reason text not null,
  canonical_brand text,
  created_at timestamptz default now()
);
create index dismissed_patterns_user_idx on public.dismissed_patterns(user_id);
alter table public.dismissed_patterns enable row level security;
create policy "own dismissed_patterns" on public.dismissed_patterns
  for all using (auth.uid() = user_id);
