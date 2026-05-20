-- Detection accuracy rebuild: drop dead columns, add scoring columns
alter table public.email_events drop column if exists cluster_id;
alter table public.email_events drop column if exists embedding;
alter table public.email_events add column if not exists rule_verdict text;
alter table public.email_events add column if not exists detection_score numeric(3,1);

alter table public.subscriptions add column if not exists detection_score numeric(3,1);

drop extension if exists vector;
