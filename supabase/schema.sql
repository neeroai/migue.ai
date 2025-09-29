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
  create type msg_type as enum ('text','image','audio','video','document','location','unknown');
exception when duplicate_object then null; end $$;
do $$ begin
  create type reminder_status as enum ('pending','sent','cancelled','failed');
exception when duplicate_object then null; end $$;

-- Extend msg_type with additional values used by WhatsApp (idempotent)
do $$ begin
  begin execute 'alter type msg_type add value if not exists ' || quote_literal('interactive'); exception when others then null; end;
  begin execute 'alter type msg_type add value if not exists ' || quote_literal('button');      exception when others then null; end;
  begin execute 'alter type msg_type add value if not exists ' || quote_literal('contacts');    exception when others then null; end;
  begin execute 'alter type msg_type add value if not exists ' || quote_literal('system');      exception when others then null; end;
end $$;

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


