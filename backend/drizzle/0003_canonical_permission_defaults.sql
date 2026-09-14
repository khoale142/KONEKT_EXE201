-- REQ-20 / PLAN-20: additive, idempotent canonical authorization defaults.
insert into public.permissions (key, name, module) values
  ('tenant.manage', 'Manage tenant', 'workspace'),
  ('store.manage', 'Manage stores', 'workspace'),
  ('member.manage', 'Manage members', 'workspace'),
  ('pos.access', 'Access POS', 'pos')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_id)
select defaults.role::public.membership_role, permissions.id
from (values
  ('owner', 'tenant.manage'), ('owner', 'store.manage'), ('owner', 'member.manage'), ('owner', 'pos.access'),
  ('manager', 'store.manage'), ('manager', 'member.manage'), ('manager', 'pos.access'),
  ('leader', 'pos.access'), ('staff', 'pos.access')
) as defaults(role, permission_key)
join public.permissions on permissions.key = defaults.permission_key
on conflict (role, permission_id) do nothing;
