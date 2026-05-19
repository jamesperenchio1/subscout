-- Add PDF parsing status to email_events
-- Values: null (no PDF found), 'parsed' (text extracted), 'image_only' (scanned PDF, no text), 'dismissed' (user dismissed from review)
alter table public.email_events
  add column if not exists pdf_parse_status text
    check (pdf_parse_status in ('parsed', 'image_only', 'dismissed'));

create index if not exists email_events_pdf_status_idx
  on public.email_events (user_id, pdf_parse_status)
  where pdf_parse_status is not null;
