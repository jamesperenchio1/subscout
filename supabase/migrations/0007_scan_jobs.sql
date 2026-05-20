-- Scan jobs table for background Inngest-driven scans
create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  latest_stage text,
  progress jsonb not null default '{"current": 0, "total": 0, "filtered": 0}',
  summary jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scan_jobs enable row level security;

create policy "users own their scan jobs"
  on public.scan_jobs for all
  using (auth.uid() = user_id);

create index if not exists scan_jobs_user_id_idx on public.scan_jobs (user_id, created_at desc);
