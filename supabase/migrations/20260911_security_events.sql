-- P0/P1 sécurité Stock Manager
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  meta jsonb default '{}'::jsonb,
  user_agent text,
  created_at timestamptz default now()
);
alter table public.security_events enable row level security;
-- admin lit tout ; user insère ses events
drop policy if exists security_events_insert_own on public.security_events;
create policy security_events_insert_own on public.security_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists security_events_select_admin on public.security_events;
create policy security_events_select_admin on public.security_events
  for select to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.role in ('super_admin', 'admin')
    )
  );
-- colonnes MFA members
alter table public.members add column if not exists mfa_enabled boolean default false;
alter table public.members add column if not exists mfa_secret text;
