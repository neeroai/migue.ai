-- Migration: Add signup onboarding fields to users
-- Purpose: Support WhatsApp Flow onboarding (name + email) for new users

alter table public.users
  add column if not exists email text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_version text not null default 'v1';

create index if not exists idx_users_email_lower on public.users (lower(email)) where email is not null;
create index if not exists idx_users_onboarding_completed_at on public.users (onboarding_completed_at);

comment on column public.users.email is 'Primary email captured during WhatsApp onboarding flow.';
comment on column public.users.onboarding_completed_at is 'Timestamp when user completed required onboarding fields.';
comment on column public.users.onboarding_version is 'Onboarding schema version used to complete signup.';

