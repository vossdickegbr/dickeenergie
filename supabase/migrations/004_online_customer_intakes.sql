-- Sichere Online-Kundenaufnahme mit E-Mail-Code und externer Unterschrift.
-- Nach 001, 002 und 003 ausführen. Die Migration ist idempotent.

create table if not exists public.online_customer_intakes (
  id text primary key,
  reserved_customer_id text not null unique,
  created_by text not null references public.team_profiles(profile_id),
  status text not null check (status in (
    'email_pending', 'email_sent', 'opened', 'completed',
    'finalized', 'expired', 'failed'
  )),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  verification_code_hash text not null check (verification_code_hash ~ '^[a-f0-9]{64}$'),
  verification_attempts integer not null default 0 check (verification_attempts >= 0),
  customer_payload jsonb not null,
  privacy_notice_version text not null,
  signature_data_url text,
  privacy_receipt jsonb,
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  opened_at timestamptz,
  email_verified_at timestamptz,
  privacy_accepted_at timestamptz,
  signed_at timestamptz,
  completed_at timestamptz,
  finalized_at timestamptz,
  delivery_error text,
  privacy_email_status text check (privacy_email_status in ('not_requested', 'pending', 'sent', 'failed', 'configuration_required')),
  privacy_email_sent_at timestamptz,
  privacy_email_error text,
  final_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.online_customer_intakes
  add column if not exists privacy_email_status text,
  add column if not exists privacy_email_sent_at timestamptz,
  add column if not exists privacy_email_error text;

create index if not exists online_customer_intakes_status_idx
  on public.online_customer_intakes(status, updated_at desc);
create index if not exists online_customer_intakes_created_by_idx
  on public.online_customer_intakes(created_by, updated_at desc);
create index if not exists online_customer_intakes_expires_idx
  on public.online_customer_intakes(expires_at)
  where status not in ('completed', 'finalized', 'expired');

create or replace function public.touch_online_customer_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_online_customer_intake_trigger on public.online_customer_intakes;
create trigger touch_online_customer_intake_trigger
before update on public.online_customer_intakes
for each row execute function public.touch_online_customer_intake();

alter table public.online_customer_intakes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'online_customer_intakes'
      and policyname = 'team can read online customer intakes'
  ) then
    create policy "team can read online customer intakes"
      on public.online_customer_intakes for select
      to authenticated
      using (public.is_fieldops_member());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'online_customer_intakes'
      and policyname = 'team can create online customer intakes'
  ) then
    create policy "team can create online customer intakes"
      on public.online_customer_intakes for insert
      to authenticated
      with check (
        public.is_fieldops_member()
        and created_by = public.current_fieldops_profile_id()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'online_customer_intakes'
      and policyname = 'team can update online customer intakes'
  ) then
    create policy "team can update online customer intakes"
      on public.online_customer_intakes for update
      to authenticated
      using (public.is_fieldops_member())
      with check (public.is_fieldops_member());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'online_customer_intakes'
      and policyname = 'team can delete online customer intakes'
  ) then
    create policy "team can delete online customer intakes"
      on public.online_customer_intakes for delete
      to authenticated
      using (public.is_fieldops_member());
  end if;
end $$;

revoke all on public.online_customer_intakes from anon;
grant select, insert, update, delete on public.online_customer_intakes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'online_customer_intakes'
  ) then
    alter publication supabase_realtime add table public.online_customer_intakes;
  end if;
end $$;
