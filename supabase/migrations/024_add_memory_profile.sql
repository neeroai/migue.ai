-- Migration: add persistent memory_profile contract (spec 20)
-- Purpose: stable personalization layer complementary to conversation window + semantic memory

create table if not exists public.memory_profile (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  tone_preference text,
  language_preference text,
  timezone text,
  goals jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memory_profile_updated_at on public.memory_profile(updated_at desc);

alter table public.memory_profile enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'memory_profile' and policyname = 'service_role_memory_profile_all'
  ) then
    create policy "service_role_memory_profile_all" on public.memory_profile
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists t_memory_profile_updated on public.memory_profile;
create trigger t_memory_profile_updated before update on public.memory_profile
for each row execute function set_updated_at();

comment on table public.memory_profile is 'Stable user profile for personalization (name, tone, language, timezone, goals, constraints)';
