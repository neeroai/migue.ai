-- migue.ai minimal schema for sessions and messages
-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
-- Optional: enable if/when migrating embeddings to pgvector
-- create extension if not exists vector;

-- Domain/Enums
do $$ begin
  create type msg_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;
do $$ begin
  create type conv_status as enum ('active','archived','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type msg_type as enum (
    'text','image','audio','video','document','location',
    'interactive','button','contacts','system','unknown'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type reminder_status as enum ('pending','sent','cancelled','failed');
exception when duplicate_object then null; end $$;

-- Removed ALTER TYPE inside same transaction to avoid
-- "unsafe use of new value" errors in Supabase SQL editor

-- Optional reusable domain for E.164 phones
do $$ begin
  create domain e164 as text check (value ~ '^[+][1-9][0-9]{7,14}$');
exception when duplicate_object then null; end $$;
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  direction msg_direction not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

-- Note: CREATE POLICY does not support IF NOT EXISTS. Use drop-first pattern.
drop policy if exists "allow_all_sessions" on public.sessions;
create policy "allow_all_sessions" on public.sessions for all using (true) with check (true);
drop policy if exists "allow_all_messages" on public.messages;
create policy "allow_all_messages" on public.messages for all using (true) with check (true);

-- =============================
-- New architecture tables
-- =============================

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone_number e164 unique not null,
  name text,
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_phone_e164 check (phone_number ~ '^[+][1-9][0-9]{7,14}$')
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wa_conversation_id varchar(64),
  status conv_status default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages_v2 (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction msg_direction not null,
  type msg_type not null,
  content text,
  media_url text,
  wa_message_id varchar(64),
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_messages_v2_conversation on public.messages_v2(conversation_id);
create index if not exists idx_messages_v2_timestamp on public.messages_v2(timestamp);
create index if not exists idx_messages_v2_conv_ts on public.messages_v2(conversation_id, timestamp desc);
create index if not exists idx_conv_status on public.conversations(status);
create index if not exists idx_users_phone on public.users(phone_number);
create index if not exists idx_messages_v2_wa on public.messages_v2(wa_message_id);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  scheduled_time timestamptz not null,
  status reminder_status not null default 'pending',
  created_at timestamptz not null default now(),
  send_token uuid
);
create index if not exists idx_reminders_user on public.reminders(user_id);
create index if not exists idx_reminders_time on public.reminders(scheduled_time);
create index if not exists idx_reminders_status_time on public.reminders(status, scheduled_time);
create unique index if not exists uniq_reminders_send_token on public.reminders(send_token) where send_token is not null;

create table if not exists public.calendar_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google',
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_calendar_provider check (provider = 'google')
);
create unique index if not exists uniq_calendar_credentials_user_provider on public.calendar_credentials(user_id, provider);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google',
  external_id text not null,
  summary text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  meeting_url text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists uniq_calendar_events_user_ext on public.calendar_events(user_id, provider, external_id);
create index if not exists idx_calendar_events_user_time on public.calendar_events(user_id, start_time);

create table if not exists public.conversation_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversation_actions_conversation on public.conversation_actions(conversation_id);
create index if not exists idx_conversation_actions_user on public.conversation_actions(user_id);

do $$ begin
  create type follow_up_status as enum ('pending','sent','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.follow_up_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  category text not null,
  status follow_up_status not null default 'pending',
  scheduled_for timestamptz not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_follow_up_jobs_status_time on public.follow_up_jobs(status, scheduled_for);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bucket text not null,
  path text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Note: for vectors use pgvector extension if available; here we store as jsonb placeholder
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  vector jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_embeddings_doc on public.embeddings(document_id);
create index if not exists idx_embeddings_chunk on public.embeddings(document_id, chunk_index);
create index if not exists idx_documents_user on public.documents(user_id);
create index if not exists idx_docs_metadata_gin on public.documents using gin (metadata);
create index if not exists idx_embeddings_metadata_gin on public.embeddings using gin (metadata);
create unique index if not exists uniq_document_user_path on public.documents(user_id, bucket, path);

-- Enable RLS
alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages_v2 enable row level security;
alter table public.reminders enable row level security;
alter table public.documents enable row level security;
alter table public.embeddings enable row level security;
alter table public.calendar_credentials enable row level security;
alter table public.calendar_events enable row level security;
alter table public.conversation_actions enable row level security;
alter table public.follow_up_jobs enable row level security;

-- Permissive policies for initial development (tighten later with auth)
drop policy if exists "allow_all_users" on public.users;
create policy "allow_all_users" on public.users for all using (true) with check (true);
drop policy if exists "allow_all_conversations" on public.conversations;
create policy "allow_all_conversations" on public.conversations for all using (true) with check (true);
drop policy if exists "allow_all_messages_v2" on public.messages_v2;
create policy "allow_all_messages_v2" on public.messages_v2 for all using (true) with check (true);
drop policy if exists "allow_all_reminders" on public.reminders;
create policy "allow_all_reminders" on public.reminders for all using (true) with check (true);
drop policy if exists "allow_all_documents" on public.documents;
create policy "allow_all_documents" on public.documents for all using (true) with check (true);
drop policy if exists "allow_all_embeddings" on public.embeddings;
create policy "allow_all_embeddings" on public.embeddings for all using (true) with check (true);
drop policy if exists "allow_all_calendar_credentials" on public.calendar_credentials;
create policy "allow_all_calendar_credentials" on public.calendar_credentials for all using (true) with check (true);
drop policy if exists "allow_all_calendar_events" on public.calendar_events;
create policy "allow_all_calendar_events" on public.calendar_events for all using (true) with check (true);
drop policy if exists "allow_all_conversation_actions" on public.conversation_actions;
create policy "allow_all_conversation_actions" on public.conversation_actions for all using (true) with check (true);
drop policy if exists "allow_all_follow_up_jobs" on public.follow_up_jobs;
create policy "allow_all_follow_up_jobs" on public.follow_up_jobs for all using (true) with check (true);

-- Business constraints & idempotency
create unique index if not exists uniq_wa_message on public.messages_v2(wa_message_id);
create unique index if not exists uniq_wa_conversation_id on public.conversations(wa_conversation_id) where wa_conversation_id is not null;
create unique index if not exists uniq_active_conversation_per_user on public.conversations(user_id) where status = 'active';

-- Metadata conventions
alter table public.documents drop constraint if exists chk_documents_metadata_is_object;
alter table public.documents add constraint chk_documents_metadata_is_object check (metadata is null or jsonb_typeof(metadata) = 'object');
alter table public.embeddings drop constraint if exists chk_embeddings_metadata_is_object;
alter table public.embeddings add constraint chk_embeddings_metadata_is_object check (metadata is null or jsonb_typeof(metadata) = 'object');

-- Messages business checks
alter table public.messages_v2 drop constraint if exists chk_msg_content_or_media;
alter table public.messages_v2 add constraint chk_msg_content_or_media check (
  (content is not null) or (media_url is not null)
);

alter table public.messages_v2 drop constraint if exists chk_msg_requirements_by_type;
alter table public.messages_v2 add constraint chk_msg_requirements_by_type check (
  (type in ('text','location','interactive','button','contacts','system') and content is not null)
  or (type in ('image','audio','video','document') and media_url is not null)
  or (type = 'unknown')
);

-- Updated_at trigger for key tables
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists t_users_updated on public.users;
create trigger t_users_updated before update on public.users
for each row execute function set_updated_at();

drop trigger if exists t_conversations_updated on public.conversations;
create trigger t_conversations_updated before update on public.conversations
for each row execute function set_updated_at();

drop trigger if exists t_calendar_credentials_updated on public.calendar_credentials;
create trigger t_calendar_credentials_updated before update on public.calendar_credentials
for each row execute function set_updated_at();

drop trigger if exists t_follow_up_jobs_updated on public.follow_up_jobs;
create trigger t_follow_up_jobs_updated before update on public.follow_up_jobs
for each row execute function set_updated_at();

-- Reminders business rules
alter table public.reminders drop constraint if exists chk_reminder_future_on_insert;
alter table public.reminders add constraint chk_reminder_future_on_insert check (created_at <= scheduled_time);

create or replace function reminders_validate_transition() returns trigger as $$
begin
  if TG_OP = 'UPDATE' then
    if not (OLD.status, NEW.status) in ((
      'pending','sent'), ('pending','cancelled'), ('pending','failed'),
      ('failed','pending'), ('failed','cancelled'),
      ('cancelled','pending')
    )) then
      raise exception 'Invalid reminder status transition: % -> %', OLD.status, NEW.status;
    end if;
  end if;
  return NEW;
end $$ language plpgsql;

drop trigger if exists t_reminders_validate on public.reminders;
create trigger t_reminders_validate before update on public.reminders
for each row execute function reminders_validate_transition();

create or replace function reminders_set_send_token() returns trigger as $$
begin
  if NEW.status = 'sent' and NEW.send_token is null then
    NEW.send_token = gen_random_uuid();
  end if;
  return NEW;
end $$ language plpgsql;

drop trigger if exists t_reminders_set_token on public.reminders;
create trigger t_reminders_set_token before update on public.reminders
for each row execute function reminders_set_send_token();

-- =============================
-- WhatsApp API v23.0 Tables
-- =============================

-- User interactions table (CTA buttons, etc.)
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
create index if not exists idx_user_interactions_user on public.user_interactions(user_id);
create index if not exists idx_user_interactions_conversation on public.user_interactions(conversation_id);
create index if not exists idx_user_interactions_type on public.user_interactions(interaction_type);
create index if not exists idx_user_interactions_timestamp on public.user_interactions(timestamp desc);

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
create index if not exists idx_user_locations_user on public.user_locations(user_id);
create index if not exists idx_user_locations_conversation on public.user_locations(conversation_id);
create index if not exists idx_user_locations_timestamp on public.user_locations(timestamp desc);
create index if not exists idx_user_locations_coords on public.user_locations(latitude, longitude);

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
create index if not exists idx_call_logs_user on public.call_logs(user_id);
create index if not exists idx_call_logs_conversation on public.call_logs(conversation_id);
create index if not exists idx_call_logs_call_id on public.call_logs(call_id);
create index if not exists idx_call_logs_timestamp on public.call_logs(timestamp desc);
create unique index if not exists uniq_call_logs_call_id on public.call_logs(call_id);

-- Flow sessions table (WhatsApp Flows)
do $$ begin
  create type flow_status as enum ('pending', 'in_progress', 'completed', 'expired', 'failed');
exception when duplicate_object then null; end $$;

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
create index if not exists idx_flow_sessions_user on public.flow_sessions(user_id);
create index if not exists idx_flow_sessions_conversation on public.flow_sessions(conversation_id);
create index if not exists idx_flow_sessions_token on public.flow_sessions(flow_token);
create index if not exists idx_flow_sessions_status on public.flow_sessions(status);
create index if not exists idx_flow_sessions_expires on public.flow_sessions(expires_at) where status in ('pending', 'in_progress');

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

-- Updated_at trigger for flow_sessions
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
