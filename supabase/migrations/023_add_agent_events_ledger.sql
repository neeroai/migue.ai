-- Migration: Add agent event queue and run ledger tables
-- Purpose: Durable event-driven backbone for agentic runtime (spec 19)

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null default 'whatsapp_webhook',
  input_type text not null,
  payload jsonb not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempt_count int not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_agent_events_idempotency_key on public.agent_events(idempotency_key);
create index if not exists idx_agent_events_status_available on public.agent_events(status, available_at);
create index if not exists idx_agent_events_conversation_created on public.agent_events(conversation_id, created_at desc);
create index if not exists idx_agent_events_user_created on public.agent_events(user_id, created_at desc);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.agent_events(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('queued','running','waiting_confirmation','completed','failed','dead_letter')),
  graph_version text not null default 'v1',
  input_class text not null,
  started_at timestamptz,
  ended_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_event on public.agent_runs(event_id);
create index if not exists idx_agent_runs_status_created on public.agent_runs(status, created_at desc);
create index if not exists idx_agent_runs_conversation_created on public.agent_runs(conversation_id, created_at desc);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  node text not null,
  status text not null check (status in ('started','ok','error','skipped')),
  input_snapshot jsonb,
  output_snapshot jsonb,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_steps_run_created on public.agent_steps(run_id, created_at);
create index if not exists idx_agent_steps_node_status on public.agent_steps(node, status);

create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  tool_name text not null,
  risk_level text not null check (risk_level in ('low','medium','high')),
  input jsonb not null,
  output jsonb,
  status text not null check (status in ('started','ok','error','timeout','blocked')),
  error text,
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists idx_agent_tool_calls_run on public.agent_tool_calls(run_id);
create index if not exists idx_agent_tool_calls_status_started on public.agent_tool_calls(status, started_at desc);

create table if not exists public.agent_checkpoints (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  node text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_checkpoints_run_created on public.agent_checkpoints(run_id, created_at desc);

alter table public.agent_events enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_checkpoints enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_events' and policyname = 'service_role_agent_events_all'
  ) then
    create policy "service_role_agent_events_all" on public.agent_events
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_runs' and policyname = 'service_role_agent_runs_all'
  ) then
    create policy "service_role_agent_runs_all" on public.agent_runs
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_steps' and policyname = 'service_role_agent_steps_all'
  ) then
    create policy "service_role_agent_steps_all" on public.agent_steps
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_tool_calls' and policyname = 'service_role_agent_tool_calls_all'
  ) then
    create policy "service_role_agent_tool_calls_all" on public.agent_tool_calls
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_checkpoints' and policyname = 'service_role_agent_checkpoints_all'
  ) then
    create policy "service_role_agent_checkpoints_all" on public.agent_checkpoints
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;

drop trigger if exists t_agent_events_updated on public.agent_events;
create trigger t_agent_events_updated before update on public.agent_events
for each row execute function set_updated_at();

comment on table public.agent_events is 'Durable queue of normalized inbound events for agent runtime';
comment on table public.agent_runs is 'Execution runs derived from queued agent_events';
comment on table public.agent_steps is 'Per-node execution trace for each agent run';
comment on table public.agent_tool_calls is 'Tool invocation audit trail per run';
comment on table public.agent_checkpoints is 'Serialized state checkpoints for run resumption';
