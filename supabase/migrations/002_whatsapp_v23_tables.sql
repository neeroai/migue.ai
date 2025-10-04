-- Migration: WhatsApp API v23.0 Tables
-- Created: 2025-10-03
-- Description: Add tables for WhatsApp v23.0 features including Flows, CTA buttons, locations, and calls

-- ========================================
-- ENUMS
-- ========================================

-- Flow status enum
do $$ begin
  create type flow_status as enum ('pending', 'in_progress', 'completed', 'expired', 'failed');
exception when duplicate_object then null; end $$;

-- ========================================
-- TABLES
-- ========================================

-- User interactions table (CTA buttons, flow completions, calls)
create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  interaction_type text not null check (interaction_type in ('cta_button_tap', 'flow_completion', 'call_accepted', 'call_rejected')),
  button_title text,
  button_url text,
  metadata jsonb,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- User locations table
create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  latitude decimal(10, 8) not null,
  longitude decimal(11, 8) not null,
  name text,
  address text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Call logs table (WhatsApp Business Calling API)
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  call_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null check (status in ('initiated', 'accepted', 'rejected', 'ended', 'failed')),
  duration_seconds integer,
  end_reason text check (end_reason in ('user_declined', 'user_busy', 'timeout', 'completed')),
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Flow sessions table (WhatsApp Flows)
create table if not exists public.flow_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  flow_id text not null,
  flow_token text not null unique,
  flow_type text not null check (flow_type in ('navigate', 'data_exchange')),
  session_data jsonb default '{}'::jsonb,
  response_data jsonb,
  status flow_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- ========================================
-- INDEXES
-- ========================================

-- user_interactions indexes
create index if not exists idx_user_interactions_user on public.user_interactions(user_id);
create index if not exists idx_user_interactions_conversation on public.user_interactions(conversation_id);
create index if not exists idx_user_interactions_type on public.user_interactions(interaction_type);
create index if not exists idx_user_interactions_timestamp on public.user_interactions(timestamp desc);

-- user_locations indexes
create index if not exists idx_user_locations_user on public.user_locations(user_id);
create index if not exists idx_user_locations_conversation on public.user_locations(conversation_id);
create index if not exists idx_user_locations_timestamp on public.user_locations(timestamp desc);
create index if not exists idx_user_locations_coords on public.user_locations(latitude, longitude);

-- call_logs indexes
create index if not exists idx_call_logs_user on public.call_logs(user_id);
create index if not exists idx_call_logs_conversation on public.call_logs(conversation_id);
create index if not exists idx_call_logs_call_id on public.call_logs(call_id);
create index if not exists idx_call_logs_timestamp on public.call_logs(timestamp desc);
create unique index if not exists uniq_call_logs_call_id on public.call_logs(call_id);

-- flow_sessions indexes
create index if not exists idx_flow_sessions_user on public.flow_sessions(user_id);
create index if not exists idx_flow_sessions_conversation on public.flow_sessions(conversation_id);
create index if not exists idx_flow_sessions_token on public.flow_sessions(flow_token);
create index if not exists idx_flow_sessions_status on public.flow_sessions(status);
create index if not exists idx_flow_sessions_expires on public.flow_sessions(expires_at) where status in ('pending', 'in_progress');

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

-- Enable RLS for v23.0 tables
alter table public.user_interactions enable row level security;
alter table public.user_locations enable row level security;
alter table public.call_logs enable row level security;
alter table public.flow_sessions enable row level security;

-- Permissive policies (tighten later with auth)
drop policy if exists "allow_all_user_interactions" on public.user_interactions;
create policy "allow_all_user_interactions" on public.user_interactions for all using (true) with check (true);

drop policy if exists "allow_all_user_locations" on public.user_locations;
create policy "allow_all_user_locations" on public.user_locations for all using (true) with check (true);

drop policy if exists "allow_all_call_logs" on public.call_logs;
create policy "allow_all_call_logs" on public.call_logs for all using (true) with check (true);

drop policy if exists "allow_all_flow_sessions" on public.flow_sessions;
create policy "allow_all_flow_sessions" on public.flow_sessions for all using (true) with check (true);

-- ========================================
-- TRIGGERS & FUNCTIONS
-- ========================================

-- Updated_at trigger for flow_sessions (assumes set_updated_at function exists from previous migrations)
drop trigger if exists t_flow_sessions_updated on public.flow_sessions;
create trigger t_flow_sessions_updated before update on public.flow_sessions
for each row execute function set_updated_at();

-- Set completed_at when flow status changes to completed
create or replace function flow_sessions_set_completed_at() returns trigger as $$
begin
  if NEW.status = 'completed' and OLD.status != 'completed' and NEW.completed_at is null then
    NEW.completed_at = now();
  end if;
  return NEW;
end $$ language plpgsql;

drop trigger if exists t_flow_sessions_set_completed on public.flow_sessions;
create trigger t_flow_sessions_set_completed before update on public.flow_sessions
for each row execute function flow_sessions_set_completed_at();
