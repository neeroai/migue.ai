-- migue.ai minimal schema for sessions and messages
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

-- Example RLS policies (adjust to your auth model)
-- Here we allow all for initial development; tighten later
create policy if not exists "allow_all_sessions" on public.sessions for all using (true) with check (true);
create policy if not exists "allow_all_messages" on public.messages for all using (true) with check (true);

-- =============================
-- New architecture tables
-- =============================

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique not null,
  name text,
  preferences jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wa_conversation_id text,
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.messages_v2 (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  type text not null,
  content text,
  media_url text,
  wa_message_id text,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_messages_v2_conversation on public.messages_v2(conversation_id);
create index if not exists idx_messages_v2_timestamp on public.messages_v2(timestamp);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  scheduled_time timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_reminders_user on public.reminders(user_id);
create index if not exists idx_reminders_time on public.reminders(scheduled_time);

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

-- Enable RLS
alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages_v2 enable row level security;
alter table public.reminders enable row level security;
alter table public.documents enable row level security;
alter table public.embeddings enable row level security;

-- Permissive policies for initial development (tighten later with auth)
create policy if not exists "allow_all_users" on public.users for all using (true) with check (true);
create policy if not exists "allow_all_conversations" on public.conversations for all using (true) with check (true);
create policy if not exists "allow_all_messages_v2" on public.messages_v2 for all using (true) with check (true);
create policy if not exists "allow_all_reminders" on public.reminders for all using (true) with check (true);
create policy if not exists "allow_all_documents" on public.documents for all using (true) with check (true);
create policy if not exists "allow_all_embeddings" on public.embeddings for all using (true) with check (true);


