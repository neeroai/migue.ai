-- Dead Letter Queue for failed webhook messages
-- Created: 2025-10-06
-- Purpose: Track failed webhook processing for manual review and retry

create table if not exists public.webhook_failures (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  wa_message_id text,
  phone_number text not null,
  raw_payload jsonb not null,
  error_message text not null,
  error_code text,
  retry_count int default 0,
  status text default 'pending' check (status in ('pending', 'retrying', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

-- Indexes for efficient querying
create index if not exists idx_webhook_failures_status on public.webhook_failures(status, created_at desc);
create index if not exists idx_webhook_failures_phone on public.webhook_failures(phone_number);
create index if not exists idx_webhook_failures_request_id on public.webhook_failures(request_id);
create index if not exists idx_webhook_failures_created on public.webhook_failures(created_at desc);

-- Enable RLS
alter table public.webhook_failures enable row level security;

-- Permissive policy for development (tighten later with auth)
drop policy if exists "allow_all_webhook_failures" on public.webhook_failures;
create policy "allow_all_webhook_failures" on public.webhook_failures
  for all using (true) with check (true);

-- Updated_at trigger
drop trigger if exists t_webhook_failures_updated on public.webhook_failures;
create trigger t_webhook_failures_updated before update on public.webhook_failures
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table public.webhook_failures is 'Dead letter queue for failed webhook message processing';
comment on column public.webhook_failures.request_id is 'Unique webhook request identifier';
comment on column public.webhook_failures.wa_message_id is 'WhatsApp message ID if available';
comment on column public.webhook_failures.phone_number is 'User phone number (E.164 format)';
comment on column public.webhook_failures.raw_payload is 'Original webhook payload for debugging';
comment on column public.webhook_failures.error_message is 'Error message from failed processing';
comment on column public.webhook_failures.error_code is 'Error code (e.g., DB constraint violation code)';
comment on column public.webhook_failures.retry_count is 'Number of retry attempts';
comment on column public.webhook_failures.status is 'Processing status: pending, retrying, resolved, ignored';
