-- Hardened RLS and RPCs for migue.ai
-- Assumes auth is enabled (Supabase Auth). Adjust to your JWT claims.

-- =============================
-- Helper: current_user_id() from JWT
-- =============================
create or replace function auth_user_id() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
$$ language sql stable;

-- =============================
-- RLS: Per-user access
-- Users: a user can only see/update their own row (match by id)
alter table public.users enable row level security;
drop policy if exists "users_self_select" on public.users;
create policy "users_self_select" on public.users
  for select using (id = auth_user_id());
drop policy if exists "users_self_update" on public.users;
create policy "users_self_update" on public.users
  for update using (id = auth_user_id()) with check (id = auth_user_id());

-- Conversations: visible if owned via users.user_id
alter table public.conversations enable row level security;
drop policy if exists "conversations_by_owner" on public.conversations;
create policy "conversations_by_owner" on public.conversations
  for select using (user_id = auth_user_id());

-- Messages: visible if conversation belongs to user
alter table public.messages_v2 enable row level security;
drop policy if exists "messages_by_owner" on public.messages_v2;
create policy "messages_by_owner" on public.messages_v2
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages_v2.conversation_id and c.user_id = auth_user_id()
    )
  );

-- Reminders: CRUD constrained to owner
alter table public.reminders enable row level security;
drop policy if exists "reminders_by_owner_select" on public.reminders;
create policy "reminders_by_owner_select" on public.reminders for select using (user_id = auth_user_id());
drop policy if exists "reminders_by_owner_modify" on public.reminders;
create policy "reminders_by_owner_modify" on public.reminders for all using (user_id = auth_user_id()) with check (user_id = auth_user_id());

-- Documents/Embeddings: select by owner
alter table public.documents enable row level security;
drop policy if exists "documents_by_owner" on public.documents;
create policy "documents_by_owner" on public.documents for all using (user_id = auth_user_id()) with check (user_id = auth_user_id());
alter table public.embeddings enable row level security;
drop policy if exists "embeddings_by_owner" on public.embeddings;
create policy "embeddings_by_owner" on public.embeddings for select using (
  exists (select 1 from public.documents d where d.id = embeddings.document_id and d.user_id = auth_user_id())
);

-- =============================
-- Service role RPCs for webhook ingestion
-- =============================
-- Note: These functions should be called with the service role key (bypass RLS)

create or replace function svc_upsert_user_by_phone(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid; begin
  insert into public.users(phone_number)
  values (p_phone)
  on conflict (phone_number) do update set phone_number = excluded.phone_number
  returning id into v_user_id;
  return v_user_id;
end $$;

create or replace function svc_get_or_create_conversation(p_user_id uuid, p_wa_id varchar)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_conv_id uuid; begin
  if p_wa_id is not null then
    select id into v_conv_id from public.conversations where wa_conversation_id = p_wa_id limit 1;
    if found then return v_conv_id; end if;
  end if;
  insert into public.conversations(user_id, wa_conversation_id, status)
  values (p_user_id, p_wa_id, 'active')
  returning id into v_conv_id;
  return v_conv_id;
end $$;

create or replace function svc_insert_inbound_message(
  p_conversation_id uuid,
  p_type msg_type,
  p_content text,
  p_media_url text,
  p_wa_message_id varchar,
  p_timestamp timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.messages_v2(
    conversation_id, direction, type, content, media_url, wa_message_id, timestamp
  ) values (
    p_conversation_id, 'inbound', p_type, p_content, p_media_url, p_wa_message_id, p_timestamp
  )
  on conflict (wa_message_id) do nothing;
end $$;

-- Grant execute to authenticated if needed; service role bypasses RLS anyway
revoke all on function svc_upsert_user_by_phone(text) from public;
revoke all on function svc_get_or_create_conversation(uuid, varchar) from public;
revoke all on function svc_insert_inbound_message(uuid, msg_type, text, text, varchar, timestamptz) from public;


