-- Breifz MVP schema
create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  full_name text not null,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.handover_photos (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.handovers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.prestarts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  handover_summary text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  type text not null check (type in ('handover', 'prestart')),
  name text not null,
  schema jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.template_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  template_id uuid not null references public.templates(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);
create index if not exists idx_projects_tenant_archived on public.projects(tenant_id, archived_at);
create index if not exists idx_handovers_project_created on public.handovers(project_id, created_at desc);
create index if not exists idx_handover_photos_handover on public.handover_photos(handover_id);
create index if not exists idx_prestarts_project_created on public.prestarts(project_id, created_at desc);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.handovers enable row level security;
alter table public.handover_photos enable row level security;
alter table public.prestarts enable row level security;
alter table public.templates enable row level security;
alter table public.template_entries enable row level security;

drop policy if exists "profiles tenant read" on public.profiles;
create policy "profiles tenant read" on public.profiles
for select to authenticated
using (tenant_id = public.current_tenant_id() or id = auth.uid());

drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self insert" on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped projects" on public.projects;
create policy "tenant scoped projects" on public.projects
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped handovers" on public.handovers;
create policy "tenant scoped handovers" on public.handovers
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped handover photos" on public.handover_photos;
create policy "tenant scoped handover photos" on public.handover_photos
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped prestarts" on public.prestarts;
create policy "tenant scoped prestarts" on public.prestarts
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped templates" on public.templates;
create policy "tenant scoped templates" on public.templates
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped template entries" on public.template_entries;
create policy "tenant scoped template entries" on public.template_entries
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

insert into storage.buckets (id, name, public)
values ('breifz-photos', 'breifz-photos', false)
on conflict (id) do nothing;

drop policy if exists "tenant photos read" on storage.objects;
create policy "tenant photos read" on storage.objects
for select to authenticated
using (
  bucket_id = 'breifz-photos'
  and (storage.foldername(name))[1] = 'tenant'
  and (storage.foldername(name))[2] = public.current_tenant_id()::text
);

drop policy if exists "tenant photos insert" on storage.objects;
create policy "tenant photos insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'breifz-photos'
  and (storage.foldername(name))[1] = 'tenant'
  and (storage.foldername(name))[2] = public.current_tenant_id()::text
);

drop policy if exists "tenant photos update" on storage.objects;
create policy "tenant photos update" on storage.objects
for update to authenticated
using (
  bucket_id = 'breifz-photos'
  and (storage.foldername(name))[1] = 'tenant'
  and (storage.foldername(name))[2] = public.current_tenant_id()::text
)
with check (
  bucket_id = 'breifz-photos'
  and (storage.foldername(name))[1] = 'tenant'
  and (storage.foldername(name))[2] = public.current_tenant_id()::text
);

drop policy if exists "tenant photos delete" on storage.objects;
create policy "tenant photos delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'breifz-photos'
  and (storage.foldername(name))[1] = 'tenant'
  and (storage.foldername(name))[2] = public.current_tenant_id()::text
);
