-- REQ-24: Store invite is the canonical employee-onboarding entry point.
-- Historic Tenant-code requests remain valid with requested_store_id NULL.
alter table public.tenant_join_requests
  add column if not exists requested_store_id integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_join_requests_requested_store_fk'
      and conrelid = 'public.tenant_join_requests'::regclass
  ) then
    alter table public.tenant_join_requests
      add constraint tenant_join_requests_requested_store_fk
      foreign key (requested_store_id)
      references public.stores(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_tenant_join_requests_requested_store_status
  on public.tenant_join_requests(requested_store_id, status);
