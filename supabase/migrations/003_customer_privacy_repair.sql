-- Reparaturmigration fuer Datenschutz-PDFs und Kundenanhaenge.
-- Diese Datei ist idempotent und kann im Supabase SQL Editor erneut ausgefuehrt werden.
-- Voraussetzung: 001_secure_fieldops.sql wurde bereits ausgefuehrt.

create table if not exists public.customer_documents (
  id text primary key,
  customer_id text not null,
  kind text not null check (kind in ('privacy_notice', 'customer_attachment')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by text references public.team_profiles(profile_id),
  created_at timestamptz not null default now()
);

create index if not exists customer_documents_customer_idx
  on public.customer_documents(customer_id, created_at desc);

alter table public.customer_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_documents'
      and policyname = 'team can read customer document metadata'
  ) then
    create policy "team can read customer document metadata"
      on public.customer_documents for select
      to authenticated
      using (public.is_fieldops_member());
  end if;
end $$;

revoke all on public.customer_documents from anon;
revoke insert, update, delete on public.customer_documents from authenticated;
grant select on public.customer_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-documents',
  'customer-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
