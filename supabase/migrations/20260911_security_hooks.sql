-- ============================================================
-- Hooks de sécurité Stock Manager AI
-- ============================================================

-- 1) Table des événements (si absente)
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid,
  meta jsonb default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_id_idx on public.security_events (user_id);
create index if not exists security_events_type_idx on public.security_events (event_type);
create index if not exists security_events_created_idx on public.security_events (created_at desc);

alter table public.security_events enable row level security;

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
      where m.user_id = auth.uid()
        and m.role in ('super_admin', 'admin')
    )
  );

-- service role / triggers : bypass RLS

-- 2) Colonnes MFA
alter table public.members
  add column if not exists mfa_enabled boolean default false,
  add column if not exists mfa_secret text;

-- 3) Fonction utilitaire log
create or replace function public.fn_log_security_event(
  p_type text,
  p_user_id uuid,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.security_events (event_type, user_id, meta)
  values (p_type, p_user_id, coalesce(p_meta, '{}'::jsonb));
exception when others then
  -- ne jamais bloquer le flux métier
  null;
end;
$$;

revoke all on function public.fn_log_security_event(text, uuid, jsonb) from public;
grant execute on function public.fn_log_security_event(text, uuid, jsonb) to authenticated, service_role;

-- 4) Hook : nouvel utilisateur auth → membre + event signup
create or replace function public.fn_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Utilisateur'
  );

  insert into public.members (user_id, email, full_name, role, status, establishment_id)
  values (new.id, new.email, v_name, 'owner', 'active', null)
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = coalesce(public.members.full_name, excluded.full_name);

  perform public.fn_log_security_event(
    'signup',
    new.id,
    jsonb_build_object('email', new.email, 'source', 'auth.users_trigger')
  );

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_security on auth.users;
create trigger on_auth_user_created_security
  after insert on auth.users
  for each row
  execute function public.fn_on_auth_user_created();

-- 5) Hook : changement rôle / MFA sur members
create or replace function public.fn_on_member_security_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.role is distinct from new.role then
      perform public.fn_log_security_event(
        'role_change',
        new.user_id,
        jsonb_build_object('from', old.role, 'to', new.role)
      );
    end if;
    if coalesce(old.mfa_enabled, false) is distinct from coalesce(new.mfa_enabled, false) then
      perform public.fn_log_security_event(
        case when new.mfa_enabled then 'mfa_setup' else 'mfa_disabled' end,
        new.user_id,
        jsonb_build_object('mfa_enabled', new.mfa_enabled)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_member_security_change on public.members;
create trigger on_member_security_change
  after update of role, mfa_enabled, mfa_secret on public.members
  for each row
  execute function public.fn_on_member_security_change();

-- 6) Empêcher un non-admin de s'auto-promouvoir admin
create or replace function public.fn_prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- service role / pas de jwt : autoriser
  if auth.uid() is null then
    return new;
  end if;

  select m.role into caller_role
  from public.members m
  where m.user_id = auth.uid()
  limit 1;

  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    if new.role in ('super_admin', 'admin')
       and coalesce(caller_role, '') not in ('super_admin', 'admin') then
      raise exception 'Escalade de privilèges interdite';
    end if;
  end if;

  if tg_op = 'INSERT' and new.role in ('super_admin', 'admin') then
    if coalesce(caller_role, '') not in ('super_admin', 'admin') then
      -- inscription classique → forcer owner
      new.role := 'owner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_privilege_escalation on public.members;
create trigger prevent_privilege_escalation
  before insert or update of role on public.members
  for each row
  execute function public.fn_prevent_privilege_escalation();
