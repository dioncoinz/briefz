-- Keep handover editing tenant-scoped without restricting updates to the creator.
-- This migration is intentionally narrow: it does not grant cross-tenant access.

alter table public.handovers enable row level security;
alter table public.handover_photos enable row level security;

drop policy if exists "tenant scoped handovers" on public.handovers;
create policy "tenant scoped handovers" on public.handovers
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant scoped handover photos" on public.handover_photos;
create policy "tenant scoped handover photos" on public.handover_photos
for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.handovers h
    where h.id = public.handover_photos.handover_id
      and h.tenant_id = public.current_tenant_id()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.handovers h
    where h.id = public.handover_photos.handover_id
      and h.tenant_id = public.current_tenant_id()
  )
);
