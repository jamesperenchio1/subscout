-- Multi-Gmail account support: per-account toggles, sync timestamps, connection status,
-- and a unique constraint that allows the same gmail_message_id across different accounts.

alter table public.gmail_accounts
  add column is_enabled boolean not null default true,
  add column last_synced_at timestamptz,
  add column connection_status text not null default 'connected'
    check (connection_status in ('connected', 'needs_reauth', 'disconnected'));

-- Same gmail_message_id can exist in two different inboxes (forwarded emails, shared aliases)
alter table public.email_events drop constraint email_events_user_id_gmail_message_id_key;
alter table public.email_events
  add constraint email_events_user_account_msg_key
  unique (user_id, gmail_account_id, gmail_message_id);
