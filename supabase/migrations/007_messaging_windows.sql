-- WhatsApp 24-hour messaging window tracking
-- Manages free messaging windows and proactive message limits
-- Created: 2025-10-07

-- Create messaging_windows table
create table if not exists public.messaging_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  phone_number text not null,
  window_opened_at timestamptz not null,
  window_expires_at timestamptz not null,
  last_user_message_id text,
  proactive_messages_sent_today int not null default 0,
  last_proactive_sent_at timestamptz,
  free_entry_point_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uniq_messaging_window_phone unique(phone_number),
  constraint uniq_messaging_window_user unique(user_id),
  constraint chk_window_expiration check (window_expires_at > window_opened_at),
  constraint chk_proactive_count check (proactive_messages_sent_today >= 0)
);

-- Indexes for performance
create index if not exists idx_messaging_windows_user
  on public.messaging_windows(user_id);

create index if not exists idx_messaging_windows_phone
  on public.messaging_windows(phone_number);

create index if not exists idx_messaging_windows_expiration
  on public.messaging_windows(window_expires_at);

create index if not exists idx_messaging_windows_free_entry
  on public.messaging_windows(free_entry_point_expires_at)
  where free_entry_point_expires_at is not null;

create index if not exists idx_messaging_windows_user_expiration
  on public.messaging_windows(user_id, window_expires_at);

-- Enable RLS
alter table public.messaging_windows enable row level security;

-- Permissive policy for development (tighten later with auth)
drop policy if exists "allow_all_messaging_windows" on public.messaging_windows;
create policy "allow_all_messaging_windows"
  on public.messaging_windows
  for all
  using (true)
  with check (true);

-- Updated_at trigger
drop trigger if exists t_messaging_windows_updated on public.messaging_windows;
create trigger t_messaging_windows_updated
  before update on public.messaging_windows
  for each row execute function set_updated_at();

-- Auto-reset daily proactive count at midnight (Colombia timezone)
create or replace function reset_daily_proactive_count()
returns trigger as $$
begin
  -- Reset counter if last proactive was sent on a different day (Colombia time)
  if new.last_proactive_sent_at is not null and
     date(new.last_proactive_sent_at at time zone 'America/Bogota') <
     date(now() at time zone 'America/Bogota') then
    new.proactive_messages_sent_today = 0;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists t_messaging_windows_reset_daily on public.messaging_windows;
create trigger t_messaging_windows_reset_daily
  before update on public.messaging_windows
  for each row execute function reset_daily_proactive_count();

-- Function to find windows near expiration (for cron job)
create or replace function find_windows_near_expiration(
  hours_threshold int default 4
)
returns table (
  user_id uuid,
  phone_number text,
  window_expires_at timestamptz,
  hours_remaining numeric,
  proactive_messages_sent_today int,
  last_proactive_sent_at timestamptz
) as $$
begin
  return query
  select
    mw.user_id,
    mw.phone_number,
    mw.window_expires_at,
    extract(epoch from (mw.window_expires_at - now())) / 3600 as hours_remaining,
    mw.proactive_messages_sent_today,
    mw.last_proactive_sent_at
  from messaging_windows mw
  where mw.window_expires_at > now()
    and mw.window_expires_at <= now() + (hours_threshold || ' hours')::interval
  order by mw.window_expires_at asc;
end $$ language plpgsql;

-- Function to check if window is open
create or replace function is_window_open(p_phone_number text)
returns boolean as $$
declare
  v_expires_at timestamptz;
begin
  select window_expires_at into v_expires_at
  from messaging_windows
  where phone_number = p_phone_number;

  if v_expires_at is null then
    return false;
  end if;

  return v_expires_at > now();
end $$ language plpgsql;

-- Function to check if free entry point is active
create or replace function is_free_entry_active(p_phone_number text)
returns boolean as $$
declare
  v_expires_at timestamptz;
begin
  select free_entry_point_expires_at into v_expires_at
  from messaging_windows
  where phone_number = p_phone_number;

  if v_expires_at is null then
    return false;
  end if;

  return v_expires_at > now();
end $$ language plpgsql;

-- Analytics view for monitoring
create or replace view messaging_windows_stats as
select
  count(*) as total_windows,
  count(*) filter (where window_expires_at > now()) as active_windows,
  count(*) filter (where window_expires_at > now() and
                        window_expires_at <= now() + interval '4 hours') as windows_near_expiration,
  count(*) filter (where free_entry_point_expires_at > now()) as free_entry_active,
  sum(proactive_messages_sent_today) as total_proactive_today,
  avg(proactive_messages_sent_today) filter (where proactive_messages_sent_today > 0)
    as avg_proactive_per_active_user
from messaging_windows;
