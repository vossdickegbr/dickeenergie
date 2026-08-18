-- Voss & Dicke FieldOps
-- Run this migration in a dedicated Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.team_profiles (
  profile_id text primary key check (profile_id in ('voss', 'dicke')),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_records (
  id text primary key,
  record_type text not null check (record_type in (
    'visit', 'customer', 'appointment', 'notification',
    'work_session', 'day_note', 'archive'
  )),
  payload jsonb not null,
  created_by text references public.team_profiles(profile_id),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_records_type_idx on public.app_records(record_type);
create index if not exists app_records_updated_idx on public.app_records(updated_at desc);
create index if not exists app_records_notification_due_idx
  on public.app_records ((payload->>'scheduledAt'))
  where record_type = 'notification';
create index if not exists app_records_customer_followup_idx
  on public.app_records ((payload->>'followUpAt'))
  where record_type = 'customer';
create unique index if not exists app_records_unique_visit_address
  on public.app_records (
    (payload->>'weekId'),
    (payload->>'dayId'),
    lower(payload->>'street'),
    lower(payload->>'houseNumber')
  ) where record_type = 'visit';

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id text references public.team_profiles(profile_id),
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.team_profiles(profile_id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.auth_rate_limits (
  key_hash text primary key,
  scope text not null,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_id text not null,
  idempotency_key text not null unique,
  sent_to text not null,
  sent_at timestamptz not null default now(),
  report_meta jsonb not null default '{}'::jsonb
);

create or replace function public.is_fieldops_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_profiles
    where auth_user_id = auth.uid() and active = true
  );
$$;


create or replace function public.current_fieldops_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profile_id
  from public.team_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.preserve_app_record_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists preserve_app_record_creator_trigger on public.app_records;
create trigger preserve_app_record_creator_trigger
before update on public.app_records
for each row execute function public.preserve_app_record_creator();

alter table public.team_profiles enable row level security;
alter table public.app_records enable row level security;
alter table public.audit_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.auth_rate_limits enable row level security;

create policy "profile can read own identity"
on public.team_profiles for select
to authenticated
using (auth_user_id = auth.uid());

create policy "team can read shared records"
on public.app_records for select
to authenticated
using (public.is_fieldops_member());

create policy "team can insert shared records"
on public.app_records for insert
to authenticated
with check (
  public.is_fieldops_member()
  and created_by = public.current_fieldops_profile_id()
);

create policy "team can update shared records"
on public.app_records for update
to authenticated
using (public.is_fieldops_member())
with check (public.is_fieldops_member());

create policy "team can read audit log"
on public.audit_log for select
to authenticated
using (public.is_fieldops_member());

create policy "team can insert audit log"
on public.audit_log for insert
to authenticated
with check (
  public.is_fieldops_member()
  and actor_profile_id = public.current_fieldops_profile_id()
);

create policy "profile manages own push subscription"
on public.push_subscriptions for all
to authenticated
using (
  profile_id = (
    select profile_id from public.team_profiles where auth_user_id = auth.uid()
  )
)
with check (
  profile_id = (
    select profile_id from public.team_profiles where auth_user_id = auth.uid()
  )
);

-- Weekly reports are written only with the server-side service key.
-- Team members can read the metadata inside the app.
create policy "team can read weekly report metadata"
on public.weekly_reports for select
to authenticated
using (public.is_fieldops_member());


-- Shared records are published for authenticated Supabase Realtime updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_records'
  ) then
    alter publication supabase_realtime add table public.app_records;
  end if;
end $$;

revoke all on public.team_profiles from anon;
revoke all on public.app_records from anon;
revoke all on public.audit_log from anon;
revoke all on public.push_subscriptions from anon;
revoke all on public.weekly_reports from anon;
revoke all on public.auth_rate_limits from anon, authenticated;
